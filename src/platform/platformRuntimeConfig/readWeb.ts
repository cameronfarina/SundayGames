import {
  assertInvitationTokenSecret,
  assertProductionAuthEmailConfig,
} from "./authEmail.js";
import type { PlatformRuntimeConfig, PlatformRuntimeEnv } from "./contracts.js";
import { isPostgresDatabaseUrl } from "./database.js";
import { assertProductionLeagueConnectionCredentialEncryption } from
  "./credentialEncryption.js";
import { optionalEnvString } from "./env.js";
import { readPlatformRuntimeConfig } from "./read.js";

export const readPlatformWebRuntimeConfig = (
  env: PlatformRuntimeEnv = process.env,
): PlatformRuntimeConfig => {
  const config = readPlatformRuntimeConfig(env, { requireDurableStore: true });
  if (config.databaseUrl !== undefined && !isPostgresDatabaseUrl(config.databaseUrl)) {
    throw new Error(
      "DATABASE_URL must be a postgres:// or postgresql:// connection string.",
    );
  }
  if (config.liveDraftDataMode !== "local-fixtures" && config.databaseUrl === undefined) {
    throw new Error(
      "DATABASE_URL is required unless MOCKD_LIVE_DRAFT_DATA_MODE=local-fixtures is set outside production.",
    );
  }
  if (
    config.liveDraftDataMode !== "local-fixtures" &&
    optionalEnvString(env, "MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY") === undefined
  ) {
    throw new Error(
      "MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY is required for Postgres-backed web startup.",
    );
  }
  if (optionalEnvString(env, "NODE_ENV") === "production") {
    assertProductionAuthEmailConfig(config.authEmail);
    assertInvitationTokenSecret(config.invitationTokenSecret);
    assertProductionLeagueConnectionCredentialEncryption(config.leagueConnectionCredentialCipher);
  }
  return config;
};
