import { z } from "zod";
import {
  accountOnboardingSchema,
  type AccountOnboardingIntent,
  type AccountOnboardingProvider,
} from "../../../shared/api/accountOnboarding/accountOnboardingSchema";
import {
  type PlatformFetch,
  requestPlatformJson,
} from "../../../shared/api/http/requestPlatformJson";

const accountOnboardingResponseSchema = z.object({ onboarding: accountOnboardingSchema });

export type AccountOnboardingAction =
  | { readonly action: "set_intent"; readonly intent: AccountOnboardingIntent }
  | { readonly action: "set_providers"; readonly providers: readonly AccountOnboardingProvider[] }
  | { readonly action: "complete" };

export const saveAccountOnboarding = async (
  accountId: string,
  action: AccountOnboardingAction,
  fetcher?: PlatformFetch,
) => {
  const requestAction = action.action === "set_intent" && action.intent === "both"
    ? { action: "set_intent", intent: "live_draft", intentBoth: true }
    : action;
  const response = await requestPlatformJson({
    path: "/account-onboarding",
    init: {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId, ...requestAction }),
    },
    responseSchema: accountOnboardingResponseSchema,
    ...(fetcher === undefined ? {} : { fetcher }),
  });
  if (action.action === "set_intent" && action.intent === "both"
    && response.onboarding.intent !== "both"
    && response.onboarding.stage !== "complete") {
    throw new Error("Sunday Games is finishing an update. Try again.");
  }
  return response;
};
