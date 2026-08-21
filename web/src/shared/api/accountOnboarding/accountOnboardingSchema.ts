import { z } from "zod";

export const accountOnboardingIntentSchema = z.enum(["practice", "live_draft", "both"]);
const storedAccountOnboardingIntentSchema = z.enum(["practice", "live_draft"]);
type StoredAccountOnboardingIntent = z.output<typeof storedAccountOnboardingIntentSchema>;
export const accountOnboardingProviderSchema = z.enum([
  "espn",
  "sleeper",
  "yahoo",
  "other",
  "none",
]);

const logicalIntent = (
  intent: StoredAccountOnboardingIntent | null,
  intentBoth: boolean | undefined,
): z.output<typeof accountOnboardingIntentSchema> | null => intentBoth === true ? "both" : intent;

export const accountOnboardingSchema = z.object({
  intent: storedAccountOnboardingIntentSchema.nullable(),
  intentBoth: z.boolean().optional(),
  providers: z.array(accountOnboardingProviderSchema).nullable(),
  stage: z.enum(["intent", "providers", "connections", "complete"]),
}).superRefine((value, context) => {
  if (value.intentBoth === true && value.intent !== "live_draft") {
    context.addIssue({
      code: "custom",
      message: "Combined onboarding intent requires the live-draft base intent.",
      path: ["intentBoth"],
    });
  }
}).transform(({ intentBoth, ...value }) => ({
  ...value,
  intent: logicalIntent(value.intent, intentBoth),
}));

export type AccountOnboarding = z.output<typeof accountOnboardingSchema>;
export type AccountOnboardingIntent = z.output<typeof accountOnboardingIntentSchema>;
export type AccountOnboardingProvider = z.output<typeof accountOnboardingProviderSchema>;
