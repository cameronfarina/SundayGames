import { InMemoryLeagueConnectionRepository } from "../../src/platform/leagueConnections.js";
import { createLeagueConnectionsHarness } from "./leagueConnections/harness.js";
import {
  connectImportableLeague,
  importLeague,
  importableRoutes,
} from "./leagueConnections/importFixtures.js";
import { expect, expectBodyRecord, it } from "./support/index.js";

const maximumSnapshotAdvances = 9;

class ChurningSnapshotRepository extends InMemoryLeagueConnectionRepository {
  churn = false;
  advances = 0;

  override async findSnapshot(connectionId: string) {
    const snapshot = await super.findSnapshot(connectionId);
    if (!this.churn || snapshot === null) return snapshot;
    this.advances += 1;
    const revision = await super.beginConnectionSync(connectionId);
    if (revision === null) return snapshot;
    await super.saveSnapshot(connectionId, {
      settings: { ...snapshot.settings, name: `Provider revision ${this.advances}` },
      teams: snapshot.teams,
      matchups: snapshot.matchups,
    }, snapshot.syncedAt, revision);
    return snapshot;
  }
}

it("returns a retryable conflict when initial import cannot reach a stable snapshot", async () => {
  const repository = new ChurningSnapshotRepository();
  const harness = await createLeagueConnectionsHarness(importableRoutes, { repository });
  const connectionId = await connectImportableLeague(harness.handle, harness.sessionToken);
  repository.churn = true;

  const changed = await importLeague(harness.handle, harness.sessionToken, connectionId);
  repository.churn = false;
  const retried = await importLeague(harness.handle, harness.sessionToken, connectionId);

  expect(changed.status).toBe(409);
  expect(expectBodyRecord(changed.body)).toMatchObject({
    error: { code: "league_import_changed" },
  });
  expect(repository.advances).toBeLessThanOrEqual(maximumSnapshotAdvances);
  expect(retried.status).toBe(200);
});
