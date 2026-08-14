import {
  assertInvitationTokenSecret,
  assertProductionAuthEmailConfig,
  authEmailConfig,
} from "./authEmail.js";
import type {
  PlatformProductionReadinessCheck,
  PlatformProductionReadinessStorage,
  PlatformRuntimeEnv,
} from "./contracts.js";
import { databaseUrlEnv, isPostgresDatabaseUrl } from "./database.js";
import { booleanEnv, errorMessage, optionalEnvString } from "./env.js";

export const storageChecks = (
  env: PlatformRuntimeEnv,
  storage: PlatformProductionReadinessStorage,
): PlatformProductionReadinessCheck[] => {
  const database = databaseUrlEnv(env);
  const databaseCheck: PlatformProductionReadinessCheck = database === undefined
    ? {
      status: "fail",
      label: "Postgres durable storage",
      detail: "DATABASE_URL is required for production/domain readiness.",
    }
    : !isPostgresDatabaseUrl(database.value)
      ? {
        status: "fail",
        label: "Postgres durable storage",
        detail: `${database.envKey} must be a postgres:// or postgresql:// connection string.`,
      }
      : {
        status: "pass",
        label: "Postgres durable storage",
        detail: `${database.envKey} is configured for durable platform storage.`,
      };
  const fileCheck: PlatformProductionReadinessCheck =
    storage.kind === "file" || storage.kind === "ambiguous"
      ? {
        status: "fail",
        label: "File-backed storage",
        detail: "MOCKD_PLATFORM_DATA_FILE is local-only and cannot be used for production/domain deployment.",
      }
      : {
        status: "pass",
        label: "File-backed storage",
        detail: "MOCKD_PLATFORM_DATA_FILE is not configured.",
      };
  return [databaseCheck, fileCheck];
};

export const accountCheck = (
  env: PlatformRuntimeEnv,
): PlatformProductionReadinessCheck => booleanEnv(env, "MOCKD_ALLOW_PUBLIC_SIGNUP")
  ? {
    status: "pass",
    label: "Account creation",
    detail: "Public account creation is enabled; league access still requires membership or an invitation.",
  }
  : {
    status: "fail",
    label: "Account creation",
    detail: "MOCKD_ALLOW_PUBLIC_SIGNUP must be true so new users can create an account.",
  };

export const emailCheck = (env: PlatformRuntimeEnv): PlatformProductionReadinessCheck => {
  try {
    assertProductionAuthEmailConfig(authEmailConfig(env));
    return {
      status: "pass",
      label: "Account email delivery",
      detail: "Resend delivery, sender identity, and the public HTTPS origin are configured.",
    };
  } catch (error) {
    return {
      status: "fail",
      label: "Account email delivery",
      detail: errorMessage(error),
    };
  }
};

export const invitationCheck = (
  env: PlatformRuntimeEnv,
): PlatformProductionReadinessCheck => {
  try {
    assertInvitationTokenSecret(optionalEnvString(env, "MOCKD_INVITATION_TOKEN_SECRET"));
    return {
      status: "pass",
      label: "League invitation signing",
      detail: "A durable league invitation signing secret is configured.",
    };
  } catch (error) {
    return {
      status: "fail",
      label: "League invitation signing",
      detail: errorMessage(error),
    };
  }
};
