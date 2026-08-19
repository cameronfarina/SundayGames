import { LeagueSyncError, type LeagueSyncAdapter } from "./contracts.js";

export const yahooProviderLabel = "Yahoo";

export const yahooPendingReviewMessage =
  "Yahoo reviews every Fantasy API application by hand, and Sunday Games is still in that queue. " +
  "Sleeper and ESPN leagues connect today.";

const unavailable = (): LeagueSyncError =>
  new LeagueSyncError("provider_unavailable", yahooPendingReviewMessage);

/**
 * Yahoo is present so the product can explain itself, not so it can sync. Read
 * access needs an application Yahoo approves by hand, so both entry points
 * refuse with the reason the owner actually needs to hear.
 */
export const yahooLeagueSyncAdapter: LeagueSyncAdapter = {
  provider: "yahoo",
  isAvailable: () => false,
  needsPlayerDirectory: false,
  discoverLeagues: () => Promise.reject(unavailable()),
  fetchLeague: () => Promise.reject(unavailable()),
};
