import { describe, expect, it, vi } from "vitest";
import {
  LeagueSyncError,
  type FetchLeagueInput,
  type LeagueSyncAdapter,
  type PlayerDirectory,
  type SyncedLeague,
} from "../src/data/leagueSyncProviderAdapters.js";
import { InMemoryLeagueConnectionRepository } from "../src/platform/leagueConnections.js";
import {
  failureFor,
  leagueSyncProviderCatalog,
  playerDirectoryMaxAgeMs,
  syncLeagueConnection,
  type LeagueSyncServiceOptions,
} from "../src/platform/leagueSyncService.js";

const now = new Date("2026-08-19T12:00:00.000Z");

const syncedLeague: SyncedLeague = {
  provider: "sleeper",
  providerLeagueId: "league-1",
  settings: {
    name: "Sleeper Friends League",
    season: "2018",
    teamCount: 1,
    rosterPositions: ["QB"],
    scoring: { rec: 1 },
  },
  teams: [{
    providerTeamId: "1",
    name: "Giant Dolphins",
    ownerNames: [],
    wins: 1,
    losses: 0,
    ties: 0,
    pointsFor: 100,
    pointsAgainst: 90,
    players: [{ providerPlayerId: "4035", name: "Alvin Kamara", starter: true }],
  }],
  matchups: [],
};

interface StubAdapterOptions {
  directory?: PlayerDirectory;
  directoryError?: Error;
  leagueError?: Error;
}

const stubAdapter = (options: StubAdapterOptions = {}) => {
  const fetchPlayerDirectory = vi.fn(async () => {
    if (options.directoryError !== undefined) throw options.directoryError;
    return options.directory ?? { "4035": { name: "Alvin Kamara" } };
  });
  const fetchLeague = vi.fn(async (_input: FetchLeagueInput, _directory: PlayerDirectory) => {
    if (options.leagueError !== undefined) throw options.leagueError;
    return syncedLeague;
  });
  const adapter: LeagueSyncAdapter = {
    provider: "sleeper",
    isAvailable: () => true,
    needsPlayerDirectory: true,
    fetchPlayerDirectory,
    discoverLeagues: async () => [],
    fetchLeague,
  };
  return { adapter, fetchLeague, fetchPlayerDirectory };
};

const serviceFor = (adapter: LeagueSyncAdapter, repository: InMemoryLeagueConnectionRepository) => {
  const espnOrYahoo: LeagueSyncAdapter = {
    provider: "espn",
    isAvailable: () => true,
    needsPlayerDirectory: false,
    discoverLeagues: async () => [],
    fetchLeague: async () => syncedLeague,
  };
  const options: LeagueSyncServiceOptions = {
    adapters: { sleeper: adapter, espn: espnOrYahoo, yahoo: espnOrYahoo },
    repository,
  };
  return options;
};

const connectionFor = async (repository: InMemoryLeagueConnectionRepository) =>
  await repository.saveConnection({
    accountId: "account-1",
    provider: "sleeper",
    providerLeagueId: "league-1",
    season: "2018",
    displayName: "Pending league",
    now,
  });

describe("league connection sync", () => {
  it("stores the league, renames the connection, and marks it healthy", async () => {
    const repository = new InMemoryLeagueConnectionRepository();
    const { adapter } = stubAdapter();
    const connection = await connectionFor(repository);

    const result = await syncLeagueConnection(serviceFor(adapter, repository), connection, now);

    expect(result.connection).toMatchObject({
      displayName: "Sleeper Friends League",
      status: "ok",
      lastSyncedAt: now.toISOString(),
    });
    expect((await repository.findSnapshot(connection.id))?.teams).toHaveLength(1);
  });

  it("pulls the player dump once a day and reuses the stored copy in between", async () => {
    const repository = new InMemoryLeagueConnectionRepository();
    const { adapter, fetchPlayerDirectory } = stubAdapter();
    const options = serviceFor(adapter, repository);
    const connection = await connectionFor(repository);

    await syncLeagueConnection(options, connection, now);
    await syncLeagueConnection(options, connection, new Date(now.getTime() + 60_000));
    await syncLeagueConnection(
      options,
      connection,
      new Date(now.getTime() + playerDirectoryMaxAgeMs + 1),
    );

    expect(fetchPlayerDirectory).toHaveBeenCalledTimes(2);
  });

  it("syncs on a stored directory when the player dump is unreachable", async () => {
    const repository = new InMemoryLeagueConnectionRepository();
    const connection = await connectionFor(repository);
    await syncLeagueConnection(serviceFor(stubAdapter().adapter, repository), connection, now);
    const offline = stubAdapter({ directoryError: new Error("dump offline") });

    const result = await syncLeagueConnection(
      serviceFor(offline.adapter, repository),
      connection,
      new Date(now.getTime() + playerDirectoryMaxAgeMs + 1),
    );

    expect(result.connection.status).toBe("ok");
    expect(offline.fetchLeague).toHaveBeenCalledOnce();
  });

  it("fails the sync when the player dump is unreachable and nothing is stored", async () => {
    const repository = new InMemoryLeagueConnectionRepository();
    const { adapter } = stubAdapter({ directoryError: new Error("dump offline") });
    const connection = await connectionFor(repository);

    const result = await syncLeagueConnection(serviceFor(adapter, repository), connection, now);

    expect(result.connection.status).toBe("error");
  });

  it("passes saved ESPN cookies to the provider without exposing them", async () => {
    const repository = new InMemoryLeagueConnectionRepository();
    const { adapter, fetchLeague } = stubAdapter();
    const connection = await repository.saveConnection({
      accountId: "account-1",
      provider: "sleeper",
      providerLeagueId: "league-1",
      season: "2018",
      displayName: "Pending league",
      credentials: { espnS2: "s2-value", swid: "{GUID}" },
      now,
    });

    const result = await syncLeagueConnection(serviceFor(adapter, repository), connection, now);

    expect(fetchLeague.mock.calls[0]?.[0]).toMatchObject({
      credentials: { espnS2: "s2-value", swid: "{GUID}" },
    });
    expect(JSON.stringify(result.connection)).not.toContain("s2-value");
  });
});

describe("sync failure classification", () => {
  it("routes fixable failures to the owner and everything else to a retry", () => {
    expect(failureFor(new LeagueSyncError("credentials_required", "Paste your cookies.")))
      .toEqual({
        code: "credentials_required",
        message: "Paste your cookies.",
        status: "needs_attention",
      });
    expect(failureFor(new LeagueSyncError("provider_unreachable", "Down.")).status).toBe("error");
    expect(failureFor(new Error("boom"))).toEqual({
      code: "sync_failed",
      message: "Something went wrong while syncing this league. Try again.",
      status: "error",
    });
  });
});

describe("provider catalog", () => {
  it("tells the owner what each provider needs before they type anything", () => {
    expect(leagueSyncProviderCatalog().map(entry => [
      entry.provider,
      entry.availability,
      entry.supportsCookieCredentials,
      entry.handleNamesOneLeague,
      entry.supportsAccountDiscovery,
    ])).toEqual([
      ["sleeper", "connectable", false, false, true],
      ["espn", "connectable", true, true, true],
      ["yahoo", "unavailable", false, false, false],
    ]);
  });
});
