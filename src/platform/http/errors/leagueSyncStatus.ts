import type { LeagueSyncFailureCode } from "../../../data/leagueSyncProviderAdapters.js";

export const leagueSyncErrorStatus = (code: LeagueSyncFailureCode): number => {
  if (code === "league_not_found") return 404;
  if (code === "provider_unavailable") return 503;
  if (code === "credentials_required" || code === "credentials_rejected") return 422;
  return 502;
};
