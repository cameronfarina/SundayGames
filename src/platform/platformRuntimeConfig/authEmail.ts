import type { AuthEmailConfig, PlatformRuntimeEnv } from "./contracts.js";
import { optionalEnvString } from "./env.js";

export const authEmailConfig = (env: PlatformRuntimeEnv): AuthEmailConfig => {
  const mode = optionalEnvString(env, "MOCKD_AUTH_EMAIL_MODE") ?? "auto-verify";
  if (mode !== "auto-verify" && mode !== "resend") {
    throw new Error("MOCKD_AUTH_EMAIL_MODE must be auto-verify or resend.");
  }
  return {
    mode,
    resendApiKey: optionalEnvString(env, "RESEND_API_KEY"),
    from: optionalEnvString(env, "MOCKD_EMAIL_FROM"),
    publicBaseUrl: optionalEnvString(env, "MOCKD_PUBLIC_BASE_URL"),
  };
};

export const assertProductionAuthEmailConfig = (
  config: AuthEmailConfig,
): void => {
  if (config.mode !== "resend") {
    throw new Error("MOCKD_AUTH_EMAIL_MODE=resend is required in production.");
  }
  if (config.resendApiKey === undefined) {
    throw new Error("RESEND_API_KEY is required in production.");
  }
  if (config.from === undefined) {
    throw new Error("MOCKD_EMAIL_FROM is required in production.");
  }
  if (config.publicBaseUrl === undefined) {
    throw new Error("MOCKD_PUBLIC_BASE_URL is required in production.");
  }
  let url: URL;
  try {
    url = new URL(config.publicBaseUrl);
  } catch {
    throw new Error("MOCKD_PUBLIC_BASE_URL must be a valid HTTPS origin.");
  }
  if (
    url.protocol !== "https:" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) throw new Error("MOCKD_PUBLIC_BASE_URL must be a valid HTTPS origin.");
};

export const assertInvitationTokenSecret = (secret: string | undefined): void => {
  if (secret === undefined || secret.length < 32) {
    throw new Error(
      "MOCKD_INVITATION_TOKEN_SECRET must be at least 32 characters in production.",
    );
  }
};
