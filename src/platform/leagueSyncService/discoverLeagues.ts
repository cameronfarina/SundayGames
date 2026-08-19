import type {
  DiscoveredLeague,
  LeagueSyncCredentials,
  LeagueSyncProvider,
} from "../../data/leagueSyncProviderAdapters.js";
import { failureFor, type LeagueSyncFailure } from "./failureStatus.js";
import type { LeagueSyncServiceOptions } from "./syncConnection.js";

export interface DiscoverLeaguesRequest {
  provider: LeagueSyncProvider;
  handle: string;
  season: string;
  credentials?: LeagueSyncCredentials | undefined;
}

export interface DiscoverLeaguesResult {
  leagues: readonly DiscoveredLeague[];
  failure?: LeagueSyncFailure | undefined;
}

export const discoverLeaguesForProvider = async (
  options: LeagueSyncServiceOptions,
  request: DiscoverLeaguesRequest,
): Promise<DiscoverLeaguesResult> => {
  try {
    return {
      leagues: await options.adapters[request.provider].discoverLeagues({
        handle: request.handle,
        season: request.season,
        ...(request.credentials === undefined ? {} : { credentials: request.credentials }),
        ...(options.fetcher === undefined ? {} : { fetcher: options.fetcher }),
      }),
    };
  } catch (error) {
    return { failure: failureFor(error), leagues: [] };
  }
};
