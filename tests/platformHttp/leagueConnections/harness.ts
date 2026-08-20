import type { LeagueSyncFetch } from "../../../src/data/leagueSyncProviderAdapters.js";
import { InMemoryLeagueConnectionRepository } from "../../../src/platform/leagueConnections.js";
import { InMemoryPlatformOnboardingRepository } from "../../../src/platform/platformOnboarding.js";
import {
  createLoggedInAccount,
  createPlatformApp,
  createPlatformHttpHandler,
  InMemoryPlatformStore,
  mockRunner,
  type PlatformApp,
  type PlatformHttpHandler,
} from "../support/index.js";
import type {
  LeagueCreationLimits,
  LeagueSetupRepository,
} from "../../../src/platform/leagueSetup.js";

export const syncNow = new Date("2026-08-19T12:00:00.000Z");

export interface StubRoute {
  body?: unknown;
  match: string;
  status?: number;
}

export const stubProviderFetch = (routes: readonly StubRoute[]): {
  fetcher: LeagueSyncFetch;
  requests: string[];
} => {
  const requests: string[] = [];
  const fetcher: LeagueSyncFetch = async url => {
    requests.push(url);
    const route = routes.find(candidate => url.includes(candidate.match));
    if (route === undefined) throw new Error(`No stub for ${url}`);
    return new Response(JSON.stringify(route.body ?? {}), { status: route.status ?? 200 });
  };
  return { fetcher, requests };
};

export interface LeagueConnectionsHarness {
  app: PlatformApp;
  handle: PlatformHttpHandler;
  otherSessionToken: string;
  repository: InMemoryLeagueConnectionRepository;
  requests: string[];
  sessionToken: string;
}

export interface LeagueConnectionsHarnessOptions {
  withRepository?: boolean;
  leagueCreationLimits?: LeagueCreationLimits;
  httpLeagueSetupRepository?: LeagueSetupRepository;
}

export const createLeagueConnectionsHarness = async (
  routes: readonly StubRoute[],
  options: LeagueConnectionsHarnessOptions = {},
): Promise<LeagueConnectionsHarness> => {
  const store = new InMemoryPlatformStore(undefined, {
    ...(options.leagueCreationLimits === undefined
      ? {}
      : { leagueCreationLimits: options.leagueCreationLimits }),
  });
  const app = createPlatformApp({ store, simulationRunner: mockRunner });
  const repository = new InMemoryLeagueConnectionRepository();
  const { fetcher, requests } = stubProviderFetch(routes);
  const handle = createPlatformHttpHandler(app, {
    leagueSyncFetch: fetcher,
    // Imported leagues resolve their public slug the same way the header does.
    onboardingRepository: new InMemoryPlatformOnboardingRepository(() => store.onboardingSnapshot()),
    ...(options.httpLeagueSetupRepository === undefined
      ? {}
      : { leagueSetupRepository: options.httpLeagueSetupRepository }),
    ...(options.withRepository === false ? {} : { leagueConnectionRepository: repository }),
  });
  const { sessionToken } = await createLoggedInAccount(handle, "owner@example.com");
  const other = await createLoggedInAccount(handle, "someone.else@example.com");

  return {
    app,
    handle,
    otherSessionToken: other.sessionToken,
    repository,
    requests,
    sessionToken,
  };
};
