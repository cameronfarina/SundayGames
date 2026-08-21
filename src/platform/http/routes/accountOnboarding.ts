import {
  accountOnboardingSnapshot,
  compatibleAccountOnboardingSnapshot,
  type AccountOnboardingIntent,
  type AccountOnboardingProvider,
} from "../../accountOnboarding.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../contracts.js";
import type { ParsedPlatformHttpRequest } from "../request/parsedRequest.js";
import { stringArrayValue, stringValue } from "../request/values.js";
import { knownError, methodNotAllowed } from "../responses.js";
import { requireRequestAccount } from "../auth/access.js";

const intentValue = (value: unknown, combinedValue: unknown): AccountOnboardingIntent | null => {
  const intent = stringValue(value);
  if (combinedValue !== undefined && typeof combinedValue !== "boolean") return null;
  if (intent === "practice") return combinedValue === true ? null : intent;
  if (intent === "live_draft") return combinedValue === true ? "both" : intent;
  return null;
};

const isProvider = (value: string): value is AccountOnboardingProvider =>
  value === "espn" || value === "sleeper" || value === "yahoo"
  || value === "other" || value === "none";

const providersValue = (value: unknown): readonly AccountOnboardingProvider[] | null => {
  const candidates = stringArrayValue(value);
  if (candidates.length === 0 || !candidates.every(isProvider)) return null;
  const unique = [...new Set(candidates)];
  if (unique.includes("none") && unique.length > 1) return null;
  return unique;
};

export const routeAccountOnboarding = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "PUT") return methodNotAllowed();
  const account = await requireRequestAccount(app, request);
  if (stringValue(request.body.accountId) !== account.id) {
    return knownError(409, "account_changed", "Your signed-in account changed. Refresh and try again.");
  }
  const repository = services.accountOnboardingRepository;
  if (repository === undefined) {
    return knownError(503, "onboarding_unavailable", "Setup is temporarily unavailable. Try again.");
  }
  const now = request.now ?? new Date();
  const action = stringValue(request.body.action);
  if (action === "set_intent") {
    const intent = intentValue(request.body.intent, request.body.intentBoth);
    if (intent === null) return knownError(400, "invalid_onboarding_intent", "Choose a setup goal.");
    await repository.setIntent({ accountId: account.id, intent, now });
  } else if (action === "set_providers") {
    const providers = providersValue(request.body.providers);
    if (providers === null) {
      return knownError(400, "invalid_onboarding_providers", "Choose at least one valid league option.");
    }
    const saved = await repository.setProviders({ accountId: account.id, providers, now });
    if (saved === null || saved.intent === null) {
      return knownError(409, "onboarding_out_of_order", "Complete the previous setup step first.");
    }
  } else if (action === "complete") {
    const saved = await repository.complete({ accountId: account.id, now });
    if (saved === null || saved.intent === null || saved.providers === null) {
      return knownError(409, "onboarding_out_of_order", "Answer the setup questions before finishing.");
    }
  } else {
    return knownError(400, "invalid_onboarding_action", "Setup action is not valid.");
  }
  return {
    status: 200,
    body: {
      onboarding: compatibleAccountOnboardingSnapshot(
        await accountOnboardingSnapshot(repository, account.id),
      ),
    },
  };
};
