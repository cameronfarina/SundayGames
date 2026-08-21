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

const deferred = () => {
  let resolve = (): void => {
    throw new Error("Deferred promise resolved before initialization.");
  };
  const promise = new Promise<void>(promiseResolve => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
};

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

const repositoryView = (
  repository: InMemoryLeagueConnectionRepository,
): InMemoryLeagueConnectionRepository => new Proxy(repository, {
  get: (target, property) => {
    const value: unknown = Reflect.get(target, property);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

describe("league connection sync", () => {
  it("does not load stored credentials for a provider that cannot use them", async () => {
    const repository = new InMemoryLeagueConnectionRepository();
    const findCredentials = vi.spyOn(repository, "findCredentials");
    const { adapter } = stubAdapter();
    const connection = await connectionFor(repository);

    await syncLeagueConnection(serviceFor(adapter, repository), connection, now);

    expect(findCredentials).not.toHaveBeenCalled();
  });

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
    expect(await repository.findConnection(connection.accountId, connection.id)).toMatchObject({
      displayName: "Sleeper Friends League",
      status: "ok",
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

  it("does not let an older slow sync replace a newer stored snapshot or season refresh", async () => {
    const repository = new InMemoryLeagueConnectionRepository();
    const connection = await connectionFor(repository);
    await repository.linkConnectionToSeason(connection.id, "season-1");
    const linkedConnection = { ...connection, leagueSeasonId: "season-1" };
    const olderFetchEntered = deferred();
    const releaseOlderFetch = deferred();
    const newerFetchEntered = deferred();
    let fetchCount = 0;
    const adapter: LeagueSyncAdapter = {
      provider: "sleeper",
      isAvailable: () => true,
      needsPlayerDirectory: false,
      discoverLeagues: async () => [],
      fetchLeague: async () => {
        fetchCount += 1;
        if (fetchCount === 1) {
          olderFetchEntered.resolve();
          await releaseOlderFetch.promise;
          return {
            ...syncedLeague,
            settings: { ...syncedLeague.settings, name: "Older slow result" },
          };
        }
        newerFetchEntered.resolve();
        return {
          ...syncedLeague,
          settings: { ...syncedLeague.settings, name: "Newer fast result" },
        };
      },
    };
    const refreshedNames: string[] = [];
    const options: LeagueSyncServiceOptions = {
      ...serviceFor(adapter, repository),
      refreshImportedSeason: async ({ snapshot }) => {
        refreshedNames.push(snapshot.settings.name);
        return null;
      },
    };
    const older = syncLeagueConnection(options, linkedConnection, now);
    await olderFetchEntered.promise;
    const newerNow = new Date(now.getTime() + 60_000);
    const newer = syncLeagueConnection(options, linkedConnection, newerNow);

    const admissionBeforeRelease = await Promise.race([
      newerFetchEntered.promise.then(() => "entered"),
      new Promise(resolve => setTimeout(() => resolve("waiting"), 25)),
    ]);

    releaseOlderFetch.resolve();
    await Promise.all([older, newer]);

    expect(await repository.findSnapshot(connection.id)).toMatchObject({
      settings: { name: "Newer fast result" },
      syncedAt: newerNow.toISOString(),
    });
    expect(admissionBeforeRelease).toBe("waiting");
    expect(refreshedNames).toEqual(["Older slow result", "Newer fast result"]);
  });

  it("uses revisions across repository identities when request timestamps tie", async () => {
    const repository = new InMemoryLeagueConnectionRepository();
    const connection = await connectionFor(repository);
    await repository.linkConnectionToSeason(connection.id, "season-1");
    const linkedConnection = { ...connection, leagueSeasonId: "season-1" };
    const slowFetchEntered = deferred();
    const releaseSlowFetch = deferred();
    let fetchCount = 0;
    const adapter: LeagueSyncAdapter = {
      provider: "sleeper",
      isAvailable: () => true,
      needsPlayerDirectory: false,
      discoverLeagues: async () => [],
      fetchLeague: async () => {
        fetchCount += 1;
        if (fetchCount === 1) {
          slowFetchEntered.resolve();
          await releaseSlowFetch.promise;
          return {
            ...syncedLeague,
            settings: { ...syncedLeague.settings, name: "Old slow result" },
          };
        }
        return {
          ...syncedLeague,
          settings: { ...syncedLeague.settings, name: "New fast result" },
        };
      },
    };
    const refreshedNames: string[] = [];
    const optionsForView = (view: InMemoryLeagueConnectionRepository): LeagueSyncServiceOptions => ({
      ...serviceFor(adapter, view),
      refreshImportedSeason: async ({ snapshot: refreshed }) => {
        refreshedNames.push(refreshed.settings.name);
        return null;
      },
    });
    const slow = syncLeagueConnection(
      optionsForView(repositoryView(repository)),
      linkedConnection,
      now,
    );
    await slowFetchEntered.promise;
    const fast = syncLeagueConnection(
      optionsForView(repositoryView(repository)),
      linkedConnection,
      now,
    );

    await fast;
    releaseSlowFetch.resolve();
    await slow;

    expect(await repository.findSnapshot(connection.id)).toMatchObject({
      settings: { name: "New fast result" },
    });
    expect(refreshedNames).toEqual(["New fast result"]);
  });

  it("returns the stored connection when an owner edit invalidates the in-flight sync", async () => {
    const repository = new InMemoryLeagueConnectionRepository();
    const connection = await connectionFor(repository);
    const adapter: LeagueSyncAdapter = {
      provider: "sleeper",
      isAvailable: () => true,
      needsPlayerDirectory: false,
      discoverLeagues: async () => [],
      fetchLeague: async () => {
        const newerRevision = await repository.beginConnectionSync(connection.id);
        if (newerRevision === null) throw new Error("Missing newer test sync.");
        await repository.saveSnapshot(
          connection.id,
          {
            ...syncedLeague,
            settings: { ...syncedLeague.settings, name: "Newer provider snapshot" },
          },
          now.toISOString(),
          newerRevision,
        );
        await repository.saveConnection({
          accountId: connection.accountId,
          provider: connection.provider,
          providerLeagueId: connection.providerLeagueId,
          season: connection.season,
          displayName: "Owner-edited name",
          now: new Date(now.getTime() + 60_000),
        });
        return {
          ...syncedLeague,
          settings: { ...syncedLeague.settings, name: "Stale provider name" },
        };
      },
    };

    const result = await syncLeagueConnection(serviceFor(adapter, repository), connection, now);

    expect(result.connection).toMatchObject({
      displayName: "Owner-edited name",
      status: "pending",
    });
    expect(result.connection?.lastSyncedAt).toBeUndefined();
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

    expect(result.connection?.status).toBe("ok");
    expect(offline.fetchLeague).toHaveBeenCalledOnce();
  });

  it("fails the sync when the player dump is unreachable and nothing is stored", async () => {
    const repository = new InMemoryLeagueConnectionRepository();
    const { adapter } = stubAdapter({ directoryError: new Error("dump offline") });
    const connection = await connectionFor(repository);

    const result = await syncLeagueConnection(serviceFor(adapter, repository), connection, now);

    expect(result.connection?.status).toBe("error");
  });

  it("passes saved ESPN cookies to the provider without exposing them", async () => {
    const repository = new InMemoryLeagueConnectionRepository();
    const { adapter: sleeperAdapter } = stubAdapter();
    const fetchLeague = vi.fn(async (
      _input: FetchLeagueInput,
      _directory: PlayerDirectory,
    ) => syncedLeague);
    const espnAdapter: LeagueSyncAdapter = {
      provider: "espn",
      isAvailable: () => true,
      needsPlayerDirectory: false,
      discoverLeagues: async () => [],
      fetchLeague,
    };
    const connection = await repository.saveConnection({
      accountId: "account-1",
      provider: "espn",
      providerLeagueId: "league-1",
      season: "2018",
      displayName: "Pending league",
      credentialUpdate: {
        mode: "replace",
        credentials: { espnS2: "s2-value", swid: "{GUID}" },
      },
      now,
    });

    const result = await syncLeagueConnection({
      adapters: { sleeper: sleeperAdapter, espn: espnAdapter, yahoo: espnAdapter },
      repository,
    }, connection, now);

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
