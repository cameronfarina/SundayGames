import type { LeagueSyncEnv, LeagueSyncProviderStatusReport } from "./contracts.js";
import { espnProvider, yahooProvider } from "./credentialProviders.js";
import {
  allConfigured,
  espnRequiredEnv,
  yahooRequiredEnv,
} from "./providerEnvironment.js";
import { mockdDraftProvider, sleeperProvider } from "./staticProviders.js";

export const leagueSyncProviderStatuses = (
  env: LeagueSyncEnv = process.env,
): LeagueSyncProviderStatusReport[] => [
  mockdDraftProvider(),
  sleeperProvider(),
  yahooProvider(allConfigured(env, yahooRequiredEnv)),
  espnProvider(allConfigured(env, espnRequiredEnv)),
];
