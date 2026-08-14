import type { LeagueSyncProviderStatusReport } from "./contracts.js";

export const mockdDraftProvider = (): LeagueSyncProviderStatusReport => ({
  key: "mockd-draft",
  label: "Mockd draft",
  status: "active",
  readOnly: true,
  auth: {
    type: "none",
    configured: true,
    requiredEnv: [],
  },
  capabilities: ["free-agents", "league-settings", "rosters"],
  detail: "Uses the current Mockd roster and available board targets.",
  setupSteps: [],
});

export const sleeperProvider = (): LeagueSyncProviderStatusReport => ({
  key: "sleeper",
  label: "Sleeper",
  status: "available",
  readOnly: true,
  auth: {
    type: "none",
    configured: true,
    requiredEnv: [],
  },
  capabilities: [
    "free-agents",
    "league-settings",
    "matchups",
    "rosters",
    "transactions",
    "trends",
  ],
  detail: "Read-only public API for users, leagues, rosters, matchups, transactions, and trending add/drop data.",
  setupSteps: ["Enter a Sleeper username or league ID, then choose the roster to analyze."],
  connectUrl: "/api/sync/sleeper/preview",
});
