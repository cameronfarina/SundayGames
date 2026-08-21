import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type { PlatformDraftOperationsConfig } from "./config.js";
import { createDiscordDraftDigestPoster } from "./digest.js";
import type { PlatformDraftOperationsRouteServices } from "./http.js";
import { PostgresPlatformDraftOperationsRepository } from "./postgresRepository.js";

export const createPlatformDraftOperationsServices = (
  config: PlatformDraftOperationsConfig,
  client: PostgresQueryClient | undefined,
): PlatformDraftOperationsRouteServices | undefined => {
  if (client === undefined) return undefined;
  const digest = config.digestTriggerToken === undefined || config.digestWebhookUrl === undefined
    ? undefined
    : {
        triggerToken: config.digestTriggerToken,
        postDiscord: createDiscordDraftDigestPoster({ webhookUrl: config.digestWebhookUrl }),
      };
  return {
    administratorAccountIds: config.administratorAccountIds,
    repository: new PostgresPlatformDraftOperationsRepository(client),
    timezone: config.timezone,
    ...(digest === undefined ? {} : { digest }),
  };
};
