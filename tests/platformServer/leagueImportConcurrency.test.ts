import type { LeagueSyncFetch } from "../../src/data/leagueSyncProviderAdapters.js";
import { InMemoryLeagueConnectionRepository } from "../../src/platform/leagueConnections.js";
import type { RegisterLeagueSeasonRepositoryInput } from "../../src/platform/leagueSetup.js";
import { InMemoryPlatformOnboardingRepository } from "../../src/platform/platformOnboarding.js";
import { importableRoutes } from "../platformHttp/leagueConnections/importFixtures.js";
import {
  AsyncLeagueSetupRepository,
  FakeTransactionalPlatformPostgresClient,
  deferred,
  expect,
  it,
  jsonFetch,
  now,
  propertyValue,
  sessionTokenFrom,
  stringProperty,
} from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

const responsivenessDeadlineMs = 1_000;
const snapshotExclusionCheckMs = 250;

class GatedLeagueSetupRepository extends AsyncLeagueSetupRepository {
  beforeNextRegister?: (() => Promise<void>) | undefined;

  override async registerLeagueSeason(input: RegisterLeagueSeasonRepositoryInput) {
    const beforeRegister = this.beforeNextRegister;
    this.beforeNextRegister = undefined;
    await beforeRegister?.();
    return await super.registerLeagueSeason(input);
  }
}

describePlatformServer(({ createListeningServer }) => {
  it("does not hold snapshot access while import refreshes provider data", async () => {
    const connections = new InMemoryLeagueConnectionRepository();
    const leagueSetup = new GatedLeagueSetupRepository();
    let beforeNextFetch: (() => Promise<void>) | undefined;
    const fetcher: LeagueSyncFetch = async url => {
      const beforeFetch = beforeNextFetch;
      beforeNextFetch = undefined;
      await beforeFetch?.();
      const route = importableRoutes.find(candidate => url.includes(candidate.match));
      if (route === undefined) throw new Error(`No provider fixture for ${url}`);
      return new Response(JSON.stringify(route.body ?? {}), { status: route.status ?? 200 });
    };
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient: new FakeTransactionalPlatformPostgresClient(),
      leagueConnectionRepository: connections,
      leagueSetupRepository: leagueSetup,
      onboardingRepository: new InMemoryPlatformOnboardingRepository(
        () => leagueSetup.inner.onboardingSnapshot(),
      ),
      leagueSyncFetch: fetcher,
    });
    await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "import-owner@example.com", password: "secure password1!" }),
    });
    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "import-owner@example.com", password: "secure password1!" }),
    });
    const sessionToken = sessionTokenFrom(login);
    const connected = await jsonFetch(baseUrl, "/league-connections", {
      method: "POST",
      headers: { "content-type": "application/json", "x-session-token": sessionToken },
      body: JSON.stringify({
        provider: "sleeper",
        providerLeagueId: "289646328504385536",
        season: "2018",
        displayName: "Sleeper Friends League",
      }),
    });
    const connectionId = stringProperty(propertyValue(connected.body, "connection"), "id");
    const stored = await connections.findSnapshot(connectionId);
    if (stored === null) throw new Error("Expected the initial provider snapshot.");
    await connections.saveSnapshot(connectionId, {
      settings: {
        name: stored.settings.name,
        season: stored.settings.season,
        teamCount: stored.settings.teamCount,
        rosterPositions: stored.settings.rosterPositions,
        scoring: stored.settings.scoring,
      },
      teams: stored.teams,
      matchups: stored.matchups,
    }, stored.syncedAt, stored.syncRevision);

    const providerFetchEntered = deferred();
    const releaseProviderFetch = deferred();
    beforeNextFetch = async () => {
      providerFetchEntered.resolve();
      await releaseProviderFetch.promise;
    };
    const seasonWriteEntered = deferred();
    const releaseSeasonWrite = deferred();
    leagueSetup.beforeNextRegister = async () => {
      seasonWriteEntered.resolve();
      await releaseSeasonWrite.promise;
    };
    const imported = jsonFetch(baseUrl, `/league-connections/${connectionId}/import`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-session-token": sessionToken },
      body: JSON.stringify({ mode: "create" }),
    });
    await providerFetchEntered.promise;
    const health = platformServer.handler({ method: "GET", path: "/healthz", now });
    const responsiveness = await Promise.race([
      health.then(response => response.status),
      new Promise<"blocked">(resolve =>
        setTimeout(() => resolve("blocked"), responsivenessDeadlineMs)
      ),
    ]);

    releaseProviderFetch.resolve();
    await seasonWriteEntered.promise;
    const excludedHealth = platformServer.handler({ method: "GET", path: "/healthz", now });
    const exclusion = await Promise.race([
      excludedHealth.then(() => "completed"),
      new Promise<"blocked">(resolve =>
        setTimeout(() => resolve("blocked"), snapshotExclusionCheckMs)
      ),
    ]);
    releaseSeasonWrite.resolve();
    await expect(Promise.all([imported, health, excludedHealth])).resolves.toMatchObject([
      { status: 200 },
      { status: 200 },
      { status: 200 },
    ]);
    expect(responsiveness).toBe(200);
    expect(exclusion).toBe("blocked");
  });
});
