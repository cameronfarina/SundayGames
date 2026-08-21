import { describe, expect, it } from "vitest";
import { z } from "zod";
import { accountOnboardingSchema } from "./accountOnboardingSchema";

const phaseOneSchema = z.object({
  intent: z.enum(["practice", "live_draft"]).nullable(),
  providers: z.array(z.enum(["espn", "sleeper", "yahoo", "other", "none"])).nullable(),
  stage: z.enum(["intent", "providers", "connections", "complete"]),
});

const combinedWireSnapshot = {
  intent: "live_draft",
  intentBoth: true,
  providers: null,
  stage: "providers",
};

describe("account onboarding response compatibility", () => {
  it("lets phase one read the base intent while phase two reconstructs Both", () => {
    expect(phaseOneSchema.parse(combinedWireSnapshot).intent).toBe("live_draft");
    expect(accountOnboardingSchema.parse(combinedWireSnapshot).intent).toBe("both");
  });

  it("rejects a combined marker without the live-draft base intent", () => {
    expect(accountOnboardingSchema.safeParse({
      ...combinedWireSnapshot,
      intent: "practice",
    }).success).toBe(false);
  });
});
