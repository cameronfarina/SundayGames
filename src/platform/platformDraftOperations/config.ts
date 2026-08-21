import type { PlatformRuntimeEnv } from "../platformRuntimeConfig.js";
import { optionalEnvString } from "../platformRuntimeConfig/env.js";
import { assertOperationalTimezone } from "./timezone.js";
import { assertDiscordWebhookUrl } from "./digest.js";

export interface PlatformDraftOperationsConfig {
  administratorAccountIds: ReadonlySet<string>;
  timezone: string;
  digestTriggerToken: string | undefined;
  digestWebhookUrl: string | undefined;
}

export const platformDraftOperationsConfigFromEnv = (
  env: PlatformRuntimeEnv = process.env,
): PlatformDraftOperationsConfig => {
  const timezone = optionalEnvString(env, "MOCKD_PLATFORM_DRAFT_OPERATIONS_TIMEZONE")
    ?? "America/New_York";
  assertOperationalTimezone(timezone);
  const accountIds = optionalEnvString(env, "MOCKD_PLATFORM_ADMIN_ACCOUNT_IDS")
    ?.split(",").map(value => value.trim()).filter(value => value.length > 0) ?? [];
  const digestTriggerToken = optionalEnvString(
    env, "MOCKD_PLATFORM_DRAFT_DIGEST_TRIGGER_TOKEN",
  );
  const digestWebhookUrl = optionalEnvString(
    env, "MOCKD_PLATFORM_DRAFT_DIGEST_WEBHOOK_URL",
  );
  if (digestTriggerToken !== undefined && digestTriggerToken.length < 32) {
    throw new Error("MOCKD_PLATFORM_DRAFT_DIGEST_TRIGGER_TOKEN must be at least 32 characters.");
  }
  if ((digestTriggerToken === undefined) !== (digestWebhookUrl === undefined)) {
    throw new Error("Draft digest trigger token and webhook URL must be configured together.");
  }
  if (digestWebhookUrl !== undefined) assertDiscordWebhookUrl(digestWebhookUrl);
  return {
    administratorAccountIds: new Set(accountIds),
    timezone,
    digestTriggerToken,
    digestWebhookUrl,
  };
};
