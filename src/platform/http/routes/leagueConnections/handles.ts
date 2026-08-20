import { LeagueSyncError, type LeagueSyncProvider } from "../../../../data/leagueSyncProviderAdapters.js";
import { leagueIdFor } from "../../../espnLeagueSettingsImport/request.js";

/**
 * ESPN identifies a league by number and accepts a pasted league URL; Sleeper
 * takes the username the owner already knows. Reusing the league-creation
 * parser keeps one place that understands ESPN league URLs. A blank ESPN handle
 * is not a bad league id: it asks for every league on the signed-in account.
 */
export const normalizedHandle = (provider: LeagueSyncProvider, handle: string): string => {
  const trimmed = handle.trim();
  if (provider !== "espn" || trimmed.length === 0) return trimmed;
  try {
    return leagueIdFor(trimmed);
  } catch (error) {
    throw new LeagueSyncError(
      "league_not_found",
      error instanceof Error ? error.message : "Enter an ESPN league ID or league URL.",
    );
  }
};
