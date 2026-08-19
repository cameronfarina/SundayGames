import { LeagueSyncError, type LeagueSyncFailureCode } from "../../data/leagueSyncProviderAdapters.js";
import type { LeagueConnectionStatus } from "../leagueConnections.js";

/**
 * Failures the owner can fix become "needs attention"; everything else is the
 * provider's problem and becomes "error", which the UI offers to retry.
 */
const ownerActionableCodes: readonly LeagueSyncFailureCode[] = [
  "credentials_required",
  "credentials_rejected",
  "league_not_found",
  "provider_unavailable",
];

export interface LeagueSyncFailure {
  code: LeagueSyncFailureCode | "sync_failed";
  message: string;
  status: LeagueConnectionStatus;
}

export const failureFor = (error: unknown): LeagueSyncFailure => {
  if (!(error instanceof LeagueSyncError)) {
    return {
      code: "sync_failed",
      message: "Something went wrong while syncing this league. Try again.",
      status: "error",
    };
  }

  return {
    code: error.code,
    message: error.message,
    status: ownerActionableCodes.includes(error.code) ? "needs_attention" : "error",
  };
};
