import {
  InMemoryLeagueConnectionRepository,
  type LeagueSnapshot,
  type SaveLeagueConnectionInput,
} from "../../src/platform/leagueConnections.js";
import { createLeagueConnectionsHarness, syncNow } from "./leagueConnections/harness.js";
import { importableRoutes } from "./leagueConnections/importFixtures.js";
import { connectSleeperLeague, connectionIdFrom } from "./leagueConnections/routes.js";
import { expect, expectBodyRecord, it } from "./support/index.js";

class DeleteBeforeSnapshotRepository extends InMemoryLeagueConnectionRepository {
  deleteBeforeNextSnapshot = false;
  #accountId = "";

  override async saveConnection(input: SaveLeagueConnectionInput) {
    const saved = await super.saveConnection(input);
    this.#accountId = saved.accountId;
    return saved;
  }

  override async saveSnapshot(
    connectionId: string,
    snapshot: LeagueSnapshot,
    syncedAt: string,
    syncRevision: string,
  ): Promise<boolean> {
    if (this.deleteBeforeNextSnapshot) {
      this.deleteBeforeNextSnapshot = false;
      await this.deleteConnection(this.#accountId, connectionId);
      return false;
    }
    return await super.saveSnapshot(connectionId, snapshot, syncedAt, syncRevision);
  }
}

it("returns connection-not-found when deletion wins an explicit sync", async () => {
  const repository = new DeleteBeforeSnapshotRepository();
  const harness = await createLeagueConnectionsHarness(importableRoutes, { repository });
  const created = await connectSleeperLeague(harness.handle, harness.sessionToken, syncNow);
  const connectionId = connectionIdFrom(created.body);
  repository.deleteBeforeNextSnapshot = true;

  const response = await harness.handle({
    method: "POST",
    path: `/league-connections/${connectionId}/sync`,
    sessionToken: harness.sessionToken,
    now: syncNow,
  });

  expect(response.status).toBe(404);
  expect(expectBodyRecord(response.body)).toMatchObject({
    error: { code: "connection_not_found" },
  });
});
