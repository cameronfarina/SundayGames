import { describe, expect, it, vi } from "vitest";
import { InMemoryLeagueConnectionRepository } from "../../src/platform/leagueConnections.js";
import { serviceOptionsFor } from "../../src/platform/http/routes/leagueConnections/context.js";
import { LeagueSetupWriteConflictError } from "../../src/platform/leagueSetup.js";

const olderTime = "2026-08-20T12:00:00.000Z";
const newerTime = "2026-08-20T12:01:00.000Z";
const snapshot = {
  settings: {
    name: "Current provider league",
    season: "2026",
    teamCount: 1,
    rosterPositions: ["QB"],
    scoring: {},
  },
  teams: [],
  matchups: [],
};

const setup = async () => {
  const repository = new InMemoryLeagueConnectionRepository();
  const saved = await repository.saveConnection({
    accountId: "account-1",
    provider: "sleeper",
    providerLeagueId: "league-1",
    season: "2026",
    displayName: snapshot.settings.name,
    now: new Date(olderTime),
  });
  await repository.linkConnectionToSeason(saved.id, "season-1");
  const connection = await repository.findConnection(saved.accountId, saved.id);
  if (connection === null) throw new Error("Test connection disappeared before sync.");
  const syncRevision = await repository.beginConnectionSync(connection.id);
  if (syncRevision === null) throw new Error("Test connection disappeared before sync.");
  await repository.saveSnapshot(connection.id, snapshot, olderTime, syncRevision);
  return { connection, repository, syncRevision };
};

describe("imported league sync refresh ordering", () => {
  it("retries an optimistic conflict while its snapshot is still current", async () => {
    const { connection, repository, syncRevision } = await setup();
    const refresh = vi.fn()
      .mockRejectedValueOnce(new LeagueSetupWriteConflictError())
      .mockResolvedValueOnce(null);
    const options = serviceOptionsFor({
      leagueConnectionRepository: repository,
      runLeagueSyncSeasonRefresh: async operation => await operation(),
    }, refresh);

    await expect(options?.refreshImportedSeason?.({
      connection,
      snapshot,
      syncedAt: olderTime,
      syncRevision,
    })).resolves.toBeNull();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("retries an optimistic conflict with the newer winning snapshot", async () => {
    const { connection, repository, syncRevision } = await setup();
    let newerRevision = "";
    const refresh = vi.fn(async input => {
      if (input.syncRevision !== syncRevision) return null;
      newerRevision = await repository.beginConnectionSync(connection.id) ?? "";
      await repository.saveSnapshot(connection.id, {
        ...snapshot,
        settings: { ...snapshot.settings, name: "Newer provider league" },
      }, newerTime, newerRevision);
      throw new LeagueSetupWriteConflictError();
    });
    const options = serviceOptionsFor({
      leagueConnectionRepository: repository,
      runLeagueSyncSeasonRefresh: async operation => await operation(),
    }, refresh);

    await expect(options?.refreshImportedSeason?.({
      connection,
      snapshot,
      syncedAt: olderTime,
      syncRevision,
    })).resolves.toBeNull();
    expect(refresh.mock.calls.map(([input]) => input.syncRevision))
      .toEqual([syncRevision, newerRevision]);
  });

  it("reapplies the current snapshot after a stale refresh succeeds last", async () => {
    const { connection, repository, syncRevision } = await setup();
    const applications: string[] = [];
    const refresh = vi.fn(async input => {
      if (input.syncRevision === syncRevision) {
        const newerRevision = await repository.beginConnectionSync(connection.id) ?? "";
        await repository.saveSnapshot(connection.id, {
          ...snapshot,
          settings: { ...snapshot.settings, name: "Newer provider league" },
        }, newerTime, newerRevision);
        applications.push("newer remote process", "older local process");
      } else {
        applications.push("newer local convergence");
      }
      return null;
    });
    const options = serviceOptionsFor({
      leagueConnectionRepository: repository,
      runLeagueSyncSeasonRefresh: async operation => await operation(),
    }, refresh);

    await expect(options?.refreshImportedSeason?.({
      connection,
      snapshot,
      syncedAt: olderTime,
      syncRevision,
    })).resolves.toBeNull();
    expect(applications).toEqual([
      "newer remote process",
      "older local process",
      "newer local convergence",
    ]);
  });

  it("refreshes the season currently linked instead of the captured stale link", async () => {
    const { connection, repository, syncRevision } = await setup();
    await repository.linkConnectionToSeason(connection.id, "season-old");
    const captured = await repository.findConnection(connection.accountId, connection.id);
    if (captured === null) throw new Error("Expected the linked connection.");
    await repository.linkConnectionToSeason(connection.id, "season-new");
    const refreshedSeasonIds: string[] = [];
    const options = serviceOptionsFor({
      leagueConnectionRepository: repository,
      runLeagueSyncSeasonRefresh: async operation => await operation(),
    }, async input => {
      refreshedSeasonIds.push(input.connection.leagueSeasonId ?? "unlinked");
      return null;
    });

    await options?.refreshImportedSeason?.({
      connection: captured,
      snapshot,
      syncedAt: olderTime,
      syncRevision,
    });

    expect(refreshedSeasonIds).toEqual(["season-new"]);
  });
});
