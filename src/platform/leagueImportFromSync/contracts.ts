import type {
  LeagueSyncProvider,
  SyncedLeagueSettings,
  SyncedTeam,
} from "../../data/leagueSyncProviderAdapters.js";
import { leagueSyncProviderCatalog } from "../leagueSyncService.js";
import type { ConfirmedLeagueCreationInput } from "../leagueCreation.js";

/** Everything a stored snapshot knows about the league it came from. */
export interface LeagueImportSource {
  provider: LeagueSyncProvider;
  providerLeagueId: string;
  settings: SyncedLeagueSettings;
  teams: readonly SyncedTeam[];
}

/**
 * Conversion either produces a league the creation domain accepts, or the list
 * of things the owner has to settle first. Issues are written for the owner,
 * not the developer: each one names the provider setting that stopped it.
 */
export type LeagueImportConversion =
  | { status: "ready"; input: ConfirmedLeagueCreationInput }
  | { status: "blocked"; issues: readonly string[] };

export const providerLabelFor = (provider: LeagueSyncProvider): string =>
  leagueSyncProviderCatalog().find(entry => entry.provider === provider)?.label ?? provider;
