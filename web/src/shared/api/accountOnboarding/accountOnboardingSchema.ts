import { z } from "zod";

export const accountOnboardingIntentSchema = z.enum(["practice", "live_draft"]);
export const accountOnboardingProviderSchema = z.enum([
  "espn",
  "sleeper",
  "yahoo",
  "other",
  "none",
]);

export const accountOnboardingSchema = z.object({
  intent: accountOnboardingIntentSchema.nullable(),
  providers: z.array(accountOnboardingProviderSchema).nullable(),
  stage: z.enum(["intent", "providers", "connections", "complete"]),
});

export type AccountOnboarding = z.output<typeof accountOnboardingSchema>;
export type AccountOnboardingIntent = z.output<typeof accountOnboardingIntentSchema>;
export type AccountOnboardingProvider = z.output<typeof accountOnboardingProviderSchema>;
