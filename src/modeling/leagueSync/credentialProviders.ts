import type { LeagueSyncProviderStatusReport } from "./contracts.js";
import { espnRequiredEnv, yahooRequiredEnv } from "./providerEnvironment.js";

export const yahooProvider = (configured: boolean): LeagueSyncProviderStatusReport => ({
  key: "yahoo",
  label: "Yahoo",
  status: configured ? "available" : "setup-required",
  readOnly: true,
  auth: {
    type: "oauth2",
    configured,
    requiredEnv: [...yahooRequiredEnv],
  },
  capabilities: ["free-agents", "league-settings", "matchups", "rosters", "transactions"],
  detail: configured
    ? "OAuth2 read-only fantasy sync is ready to start."
    : "OAuth2 read-only fantasy sync needs a Yahoo Developer app before users can connect leagues.",
  setupSteps: [
    "Create a Yahoo Developer app with Fantasy Sports API access.",
    "Add the local callback URL to the Yahoo app redirect URIs.",
    "Set MOCKD_YAHOO_CLIENT_ID and MOCKD_YAHOO_CLIENT_SECRET before starting the server.",
  ],
  connectUrl: "/api/sync/oauth/yahoo/start",
});

export const espnProvider = (configured: boolean): LeagueSyncProviderStatusReport => ({
  key: "espn",
  label: "ESPN",
  status: configured ? "available" : "setup-required",
  readOnly: true,
  auth: {
    type: "manual-cookie",
    configured,
    requiredEnv: [...espnRequiredEnv],
  },
  capabilities: ["free-agents", "league-settings", "matchups", "rosters"],
  detail: configured
    ? "Local read-only ESPN sync credentials are present."
    : "ESPN does not expose a comparable public fantasy OAuth setup here, so private league sync is gated behind local read-only credentials.",
  setupSteps: [
    "Keep ESPN sync local-only until product/legal confirms the supported access path.",
    "Set MOCKD_ESPN_LEAGUE_ID, MOCKD_ESPN_SWID, and MOCKD_ESPN_S2 in local env for read-only testing.",
    "Do not collect or store ESPN cookies in the hosted app without a provider-approved integration path.",
  ],
});
