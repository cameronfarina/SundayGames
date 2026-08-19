import type {
  LeagueSyncAdapter,
  LeagueSyncRequestOptions,
  PlayerDirectory,
} from "../../data/leagueSyncProviderAdapters.js";
import type { LeagueConnectionRepository } from "../leagueConnections.js";

/**
 * Sleeper asks callers to pull the player dump at most once a day, and it is
 * the only thing that turns roster ids into names, so a stale copy is far
 * better than a refused request.
 */
export const playerDirectoryMaxAgeMs = 24 * 60 * 60 * 1000;
/** The dump is roughly 15 MB, so it gets a longer deadline than a league read. */
export const playerDirectoryTimeoutMs = 45_000;

const isFresh = (fetchedAt: string, now: Date): boolean => {
  const age = now.getTime() - Date.parse(fetchedAt);
  return Number.isFinite(age) && age >= 0 && age < playerDirectoryMaxAgeMs;
};

export const playerDirectoryFor = async (
  adapter: LeagueSyncAdapter,
  repository: LeagueConnectionRepository,
  options: LeagueSyncRequestOptions,
  now: Date,
): Promise<PlayerDirectory> => {
  const fetchDirectory = adapter.fetchPlayerDirectory;
  if (!adapter.needsPlayerDirectory || fetchDirectory === undefined) return {};

  const stored = await repository.findPlayerDirectory(adapter.provider);
  if (stored !== null && isFresh(stored.fetchedAt, now)) return stored.entries;

  try {
    const entries = await fetchDirectory({ ...options, timeoutMs: playerDirectoryTimeoutMs });
    await repository.savePlayerDirectory({
      provider: adapter.provider,
      entries,
      fetchedAt: now.toISOString(),
    });
    return entries;
  } catch (error) {
    // A missing directory only costs player names, so an outage must not fail
    // a sync that would otherwise return a whole league.
    if (stored === null) throw error;
    return stored.entries;
  }
};
