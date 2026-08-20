import { InMemoryLeagueConnectionRepository } from "../../src/platform/leagueConnections.js";
import { createLeagueConnectionsHarness } from "./leagueConnections/harness.js";
import {
  connectImportableLeague,
  importLeague,
  importableRoutes,
} from "./leagueConnections/importFixtures.js";
import { expect, expectBodyRecord, expectString, it } from "./support/index.js";

class SnapshotBeforeLinkRepository extends InMemoryLeagueConnectionRepository {
  beforeNextLink?: ((connectionId: string) => Promise<void>) | undefined;

  override async linkConnectionToSeason(connectionId: string, seasonId: string): Promise<void> {
    const beforeLink = this.beforeNextLink;
    this.beforeNextLink = undefined;
    await beforeLink?.(connectionId);
    await super.linkConnectionToSeason(connectionId, seasonId);
  }
}

it("imports the current snapshot when a remote sync wins before the initial link", async () => {
  const repository = new SnapshotBeforeLinkRepository();
  const harness = await createLeagueConnectionsHarness(importableRoutes, { repository });
  const connectionId = await connectImportableLeague(harness.handle, harness.sessionToken);
  repository.beforeNextLink = async id => {
    const current = await repository.findSnapshot(id);
    if (current === null) throw new Error("Expected the initially synced snapshot.");
    const revision = await repository.beginConnectionSync(id);
    if (revision === null) throw new Error("Expected the connection to remain available.");
    await repository.saveSnapshot(id, {
      settings: { ...current.settings, name: "Newer provider league" },
      teams: current.teams,
      matchups: current.matchups,
    }, current.syncedAt, revision);
  };

  const imported = await importLeague(harness.handle, harness.sessionToken, connectionId);
  const importedSeasonId = expectString(
    expectBodyRecord(expectBodyRecord(imported.body).imported).seasonId,
  );
  const seasonResponse = await harness.handle({
    method: "GET",
    path: `/seasons/${importedSeasonId}`,
    sessionToken: harness.sessionToken,
  });
  const season = expectBodyRecord(expectBodyRecord(seasonResponse.body).season);

  expect(imported.status).toBe(200);
  expect(expectBodyRecord(season.league).name).toBe("Newer provider league");
});
