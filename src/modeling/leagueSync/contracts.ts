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

export type LeagueSyncEnv = Record<string, string | undefined>;

export interface YahooOAuthAuthorizeOptions {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string | undefined;
}
