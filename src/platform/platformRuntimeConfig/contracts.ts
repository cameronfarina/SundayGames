import type { JobKind } from "../jobs.js";
import type { PracticePersistenceMode } from "../practicePersistenceMode.js";
import type { LeagueConnectionCredentialCipher } from
  "../leagueConnectionCredentialEncryption.js";
import type { PlatformDraftOperationsConfig } from "../platformDraftOperations.js";

export interface PlatformRuntimeEnv {
  readonly [key: string]: string | undefined;
}

export interface ReadPlatformRuntimeConfigOptions {
  requireDatabase?: boolean | undefined;
  requireDurableStore?: boolean | undefined;
  requireRunnableWorker?: boolean | undefined;
}

export interface AuthEmailConfig {
  mode: "auto-verify" | "resend";
  resendApiKey: string | undefined;
  from: string | undefined;
  publicBaseUrl: string | undefined;
  signupNotificationEmail: string | undefined;
}

export interface ScreenshotImportConfig {
  mode: "disabled" | "openai";
  apiKey: string | undefined;
  model: string;
  timeoutMs: number;
  maxImageBytes: number;
  maxConcurrentRequests: number;
}

export interface FantasyProsConfig {
  apiKey: string | undefined;
  refreshEnabled: boolean;
  season: number;
}

export interface PlayerNewsConfig {
  /** RotoWire needs no key, so its refresh is switched off explicitly. */
  refreshEnabled: boolean;
}

export interface PlatformRuntimeConfig {
  host: string;
  port: number;
  databaseUrl: string | undefined;
  dataFilePath: string | undefined;
  postgresPoolSize: number;
  postgresStatementTimeoutMs: number | undefined;
  postgresSnapshotKey: string | undefined;
  practicePersistenceMode: PracticePersistenceMode;
  initializePostgresSchema: boolean;
  draftToolsSessionDirectory: string;
  legacyMockBatchEnabled: boolean;
  allowPublicSignup: boolean;
  trustProxy: boolean;
  liveDraftDataMode: "postgres" | "local-fixtures";
  liveDraftRoomEventStreamMaxConnections: number;
  platformDraftOperations: PlatformDraftOperationsConfig;
  provisioningToken: string | undefined;
  invitationTokenSecret: string | undefined;
  leagueConnectionCredentialCipher: LeagueConnectionCredentialCipher | undefined;
  authEmail: AuthEmailConfig;
  simulationDataMode: "disabled" | "local-fixtures";
  screenshotImport: ScreenshotImportConfig;
  fantasyPros: FantasyProsConfig;
  playerNews: PlayerNewsConfig;
  worker: {
    workerId: string;
    jobKinds: readonly JobKind[];
    pollIntervalMs: number;
    lockTtlMs: number;
  };
}

export type PlatformProductionReadinessCheckStatus = "pass" | "fail";

export interface PlatformProductionReadinessCheck {
  status: PlatformProductionReadinessCheckStatus;
  label: string;
  detail: string;
}

export type PlatformDatabaseUrlEnvKey = "DATABASE_URL" | "MOCKD_DATABASE_URL";

export interface PlatformDatabaseUrlEnvValue {
  envKey: PlatformDatabaseUrlEnvKey;
  value: string;
}

export type PlatformProductionReadinessStorage =
  | { kind: "postgres"; envKey: PlatformDatabaseUrlEnvKey }
  | { kind: "file"; dataFilePath: string }
  | {
    kind: "ambiguous";
    databaseEnvKey: PlatformDatabaseUrlEnvKey;
    dataFilePath: string;
  }
  | { kind: "missing" };

export interface PlatformProductionReadinessReport {
  ready: boolean;
  host: string;
  port: number | undefined;
  storage: PlatformProductionReadinessStorage;
  checks: readonly PlatformProductionReadinessCheck[];
  nextSteps: readonly string[];
}
