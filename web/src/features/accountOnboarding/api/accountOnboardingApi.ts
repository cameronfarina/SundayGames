import { z } from "zod";
import {
  accountOnboardingSchema,
  type AccountOnboardingIntent,
  type AccountOnboardingProvider,
} from "../../../shared/api/accountOnboarding/accountOnboardingSchema";
import { requestPlatformJson } from "../../../shared/api/http/requestPlatformJson";

const accountOnboardingResponseSchema = z.object({ onboarding: accountOnboardingSchema });

export type AccountOnboardingAction =
  | { readonly action: "set_intent"; readonly intent: AccountOnboardingIntent }
  | { readonly action: "set_providers"; readonly providers: readonly AccountOnboardingProvider[] }
  | { readonly action: "complete" };

export const saveAccountOnboarding = async (
  accountId: string,
  action: AccountOnboardingAction,
) => await requestPlatformJson({
  path: "/account-onboarding",
  init: {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accountId, ...action }),
  },
  responseSchema: accountOnboardingResponseSchema,
});
