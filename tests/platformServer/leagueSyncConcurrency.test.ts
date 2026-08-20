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
const completedResponse = <T>(response: T): { state: "completed"; response: T } => ({
  state: "completed",
  response,
});

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
  it("holds snapshot access only while a linked league sync refreshes its season", async () => {
    const connectionRepository = new InMemoryLeagueConnectionRepository();
    const leagueSetupRepository = new GatedLeagueSetupRepository();
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
      leagueConnectionRepository: connectionRepository,
      leagueSetupRepository,
      onboardingRepository: new InMemoryPlatformOnboardingRepository(
        () => leagueSetupRepository.inner.onboardingSnapshot(),
      ),
      leagueSyncFetch: fetcher,
    });
    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "sync-owner@example.com", password: "secure password1!" }),
    });
    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "sync-owner@example.com", password: "secure password1!" }),
    });
    expect(created.status).toBe(201);
    const sessionToken = sessionTokenFrom(login);
    const connected = await jsonFetch(baseUrl, "/league-connections", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        provider: "sleeper",
        providerLeagueId: "289646328504385536",
        season: "2018",
        displayName: "Sleeper Friends League",
      }),
    });
    const connectionId = stringProperty(propertyValue(connected.body, "connection"), "id");
    const imported = await jsonFetch(baseUrl, `/league-connections/${connectionId}/import`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({ mode: "create" }),
    });
    expect(imported.status).toBe(200);

    const providerFetchEntered = deferred();
    const releaseProviderFetch = deferred();
    beforeNextFetch = async () => {
      providerFetchEntered.resolve();
      await releaseProviderFetch.promise;
    };
    const seasonRefreshEntered = deferred();
    const releaseSeasonRefresh = deferred();
    leagueSetupRepository.beforeNextRegister = async () => {
      seasonRefreshEntered.resolve();
      await releaseSeasonRefresh.promise;
    };

    const sync = jsonFetch(baseUrl, `/league-connections/${connectionId}/sync`, {
      method: "POST",
      headers: { "x-session-token": sessionToken },
    });
    await providerFetchEntered.promise;
    const sessionRead = platformServer.handler({
      method: "GET",
      path: "/session",
      sessionToken,
      now,
    });
    const remoteWaitResponsiveness = await Promise.race([
      sessionRead.then(completedResponse),
      new Promise<{ state: "blocked" }>(resolve =>
        setTimeout(() => resolve({ state: "blocked" }), responsivenessDeadlineMs)
      ),
    ]);

    releaseProviderFetch.resolve();
    await seasonRefreshEntered.promise;
    const healthRead = platformServer.handler({ method: "GET", path: "/healthz", now });
    const refreshExclusion = await Promise.race([
      healthRead.then(() => "completed"),
      new Promise(resolve => setTimeout(() => resolve("blocked"), snapshotExclusionCheckMs)),
    ]);

    releaseSeasonRefresh.resolve();
    await expect(Promise.all([sync, sessionRead, healthRead])).resolves.toMatchObject([
      { status: 200 },
      { status: 200 },
      { status: 200 },
    ]);
    expect(remoteWaitResponsiveness).toMatchObject({
      state: "completed",
      response: { status: 200 },
    });
    expect(refreshExclusion).toBe("blocked");
  });
});
