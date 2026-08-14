export type LeagueSyncProviderKey = "mockd-draft" | "espn" | "sleeper" | "yahoo";
export type LeagueSyncProviderStatus = "active" | "available" | "setup-required";
export type LeagueSyncAuthType = "none" | "manual-cookie" | "oauth2";
export type LeagueSyncCapability =
  | "free-agents"
  | "league-settings"
  | "matchups"
  | "news"
  | "rosters"
  | "transactions"
  | "trends";

export interface LeagueSyncAuthStatus {
  type: LeagueSyncAuthType;
  configured: boolean;
  requiredEnv: string[];
}

export interface LeagueSyncProviderStatusReport {
  key: LeagueSyncProviderKey;
  label: string;
  status: LeagueSyncProviderStatus;
  readOnly: true;
  auth: LeagueSyncAuthStatus;
  capabilities: LeagueSyncCapability[];
  detail: string;
  setupSteps: string[];
  connectUrl?: string | undefined;
}

export interface LeagueSyncReadOnlyPolicy {
  mode: "read-only";
  allowedActions: readonly ["recommend", "sync"];
  blockedActions: readonly ["add", "drop", "trade", "set-lineup", "submit-waiver-claim"];
}

type LeagueSyncEnv = Record<string, string | undefined>;

export const yahooAuthorizationEndpoint = "https://api.login.yahoo.com/oauth2/request_auth";
export const yahooTokenEndpoint = "https://api.login.yahoo.com/oauth2/get_token";
export const yahooFantasyReadScope = "fspt-r";

export const leagueSyncReadOnlyPolicy: LeagueSyncReadOnlyPolicy = {
  mode: "read-only",
  allowedActions: ["recommend", "sync"],
  blockedActions: ["add", "drop", "trade", "set-lineup", "submit-waiver-claim"],
};

const hasEnvValue = (env: LeagueSyncEnv, key: string): boolean => Boolean(env[key]?.trim());

const allConfigured = (env: LeagueSyncEnv, keys: readonly string[]): boolean =>
  keys.every(key => hasEnvValue(env, key));

const yahooRequiredEnv: readonly string[] = [
  "MOCKD_YAHOO_CLIENT_ID",
  "MOCKD_YAHOO_CLIENT_SECRET",
];
const espnRequiredEnv: readonly string[] = [
  "MOCKD_ESPN_LEAGUE_ID",
  "MOCKD_ESPN_SWID",
  "MOCKD_ESPN_S2",
];

export const leagueSyncProviderStatuses = (
  env: LeagueSyncEnv = process.env,
): LeagueSyncProviderStatusReport[] => {
  const yahooConfigured = allConfigured(env, yahooRequiredEnv);
  const espnConfigured = allConfigured(env, espnRequiredEnv);

  return [
    {
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
    },
    {
      key: "sleeper",
      label: "Sleeper",
      status: "available",
      readOnly: true,
      auth: {
        type: "none",
        configured: true,
        requiredEnv: [],
      },
      capabilities: ["free-agents", "league-settings", "matchups", "rosters", "transactions", "trends"],
      detail: "Read-only public API for users, leagues, rosters, matchups, transactions, and trending add/drop data.",
      setupSteps: ["Enter a Sleeper username or league ID, then choose the roster to analyze."],
      connectUrl: "/api/sync/sleeper/preview",
    },
    {
      key: "yahoo",
      label: "Yahoo",
      status: yahooConfigured ? "available" : "setup-required",
      readOnly: true,
      auth: {
        type: "oauth2",
        configured: yahooConfigured,
        requiredEnv: [...yahooRequiredEnv],
      },
      capabilities: ["free-agents", "league-settings", "matchups", "rosters", "transactions"],
      detail: yahooConfigured
        ? "OAuth2 read-only fantasy sync is ready to start."
        : "OAuth2 read-only fantasy sync needs a Yahoo Developer app before users can connect leagues.",
      setupSteps: [
        "Create a Yahoo Developer app with Fantasy Sports API access.",
        "Add the local callback URL to the Yahoo app redirect URIs.",
        "Set MOCKD_YAHOO_CLIENT_ID and MOCKD_YAHOO_CLIENT_SECRET before starting the server.",
      ],
      connectUrl: "/api/sync/oauth/yahoo/start",
    },
    {
      key: "espn",
      label: "ESPN",
      status: espnConfigured ? "available" : "setup-required",
      readOnly: true,
      auth: {
        type: "manual-cookie",
        configured: espnConfigured,
        requiredEnv: [...espnRequiredEnv],
      },
      capabilities: ["free-agents", "league-settings", "matchups", "rosters"],
      detail: espnConfigured
        ? "Local read-only ESPN sync credentials are present."
        : "ESPN does not expose a comparable public fantasy OAuth setup here, so private league sync is gated behind local read-only credentials.",
      setupSteps: [
        "Keep ESPN sync local-only until product/legal confirms the supported access path.",
        "Set MOCKD_ESPN_LEAGUE_ID, MOCKD_ESPN_SWID, and MOCKD_ESPN_S2 in local env for read-only testing.",
        "Do not collect or store ESPN cookies in the hosted app without a provider-approved integration path.",
      ],
    },
  ];
};

export interface YahooOAuthAuthorizeOptions {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string | undefined;
}

export const yahooOAuthAuthorizeUrl = ({
  clientId,
  redirectUri,
  state,
  scope = yahooFantasyReadScope,
}: YahooOAuthAuthorizeOptions): string => {
  const url = new URL(yahooAuthorizationEndpoint);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  return url.toString();
};
