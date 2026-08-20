import type { LeagueSyncAdapter } from "../src/data/leagueSyncProviderAdapters.js";
import { InMemoryLeagueConnectionRepository } from "../src/platform/leagueConnections.js";
import { syncLeagueConnection } from "../src/platform/leagueSyncService.js";
import { expect, it } from "vitest";

it("returns no connection when deletion invalidates an in-flight sync", async () => {
  const repository = new InMemoryLeagueConnectionRepository();
  const now = new Date("2026-08-20T12:00:00.000Z");
  const connection = await repository.saveConnection({
    accountId: "account-1",
    provider: "sleeper",
    providerLeagueId: "league-1",
    season: "2026",
    displayName: "Pending league",
    now,
  });
  const adapter: LeagueSyncAdapter = {
    provider: "sleeper",
    isAvailable: () => true,
    needsPlayerDirectory: false,
    discoverLeagues: async () => [],
    fetchLeague: async () => {
      await repository.deleteConnection(connection.accountId, connection.id);
      return {
        provider: "sleeper",
        providerLeagueId: connection.providerLeagueId,
        settings: {
          name: "Deleted provider league",
          season: connection.season,
          teamCount: 1,
          rosterPositions: ["QB"],
          scoring: {},
        },
        teams: [],
        matchups: [],
      };
    },
  };

  const result = await syncLeagueConnection({
    adapters: { sleeper: adapter, espn: adapter, yahoo: adapter },
    repository,
  }, connection, now);

  expect(result.connection).toBeNull();
  expect(await repository.findConnection(connection.accountId, connection.id)).toBeNull();
});
