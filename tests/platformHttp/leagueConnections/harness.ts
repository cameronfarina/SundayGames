import type { LeagueSyncFetch } from "../../../src/data/leagueSyncProviderAdapters.js";
import { InMemoryLeagueConnectionRepository } from "../../../src/platform/leagueConnections.js";
import {
  createLoggedInAccount,
  createPlatformApp,
  createPlatformHttpHandler,
  InMemoryPlatformStore,
  mockRunner,
  type PlatformHttpHandler,
} from "../support/index.js";

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
  handle: PlatformHttpHandler;
  otherSessionToken: string;
  repository: InMemoryLeagueConnectionRepository;
  requests: string[];
  sessionToken: string;
}

export const createLeagueConnectionsHarness = async (
  routes: readonly StubRoute[],
  options: { withRepository?: boolean } = {},
): Promise<LeagueConnectionsHarness> => {
  const store = new InMemoryPlatformStore();
  const app = createPlatformApp({ store, simulationRunner: mockRunner });
  const repository = new InMemoryLeagueConnectionRepository();
  const { fetcher, requests } = stubProviderFetch(routes);
  const handle = createPlatformHttpHandler(app, {
    leagueSyncFetch: fetcher,
    ...(options.withRepository === false ? {} : { leagueConnectionRepository: repository }),
  });
  const { sessionToken } = await createLoggedInAccount(handle, "owner@example.com");
  const other = await createLoggedInAccount(handle, "someone.else@example.com");

  return { handle, otherSessionToken: other.sessionToken, repository, requests, sessionToken };
};
