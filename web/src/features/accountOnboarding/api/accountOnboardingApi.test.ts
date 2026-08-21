import { describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import { saveAccountOnboarding } from "./accountOnboardingApi";

const onboardingResponse = (
  intent: "both" | "live_draft",
  stage: "providers" | "complete" = "providers",
): Response => new Response(
  JSON.stringify({
    onboarding: {
      intent: "live_draft",
      ...(intent === "both" ? { intentBoth: true } : {}),
      providers: null,
      stage,
    },
  }),
  { headers: { "content-type": "application/json" }, status: 200 },
);

const updateRequiredResponse = (): Response => new Response(JSON.stringify({
  error: {
    code: "onboarding_update_required",
    message: "Sunday Games is finishing an update. Try again.",
  },
}), { headers: { "content-type": "application/json" }, status: 409 });

describe("account onboarding API", () => {
  it("sends Both in the wire format accepted by the compatibility release", async () => {
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(onboardingResponse("both"));

    await saveAccountOnboarding("account-1", { action: "set_intent", intent: "both" }, fetcher);

    expect(fetcher).toHaveBeenCalledWith("/account-onboarding", expect.objectContaining({
      body: JSON.stringify({
        accountId: "account-1",
        action: "set_intent",
        intent: "live_draft",
        intentBoth: true,
      }),
    }));
  });

  it("does not advance when a draining compatibility server cannot save Both", async () => {
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(updateRequiredResponse());

    await expect(saveAccountOnboarding(
      "account-1",
      { action: "set_intent", intent: "both" },
      fetcher,
    )).rejects.toThrow("Sunday Games is finishing an update. Try again.");
  });

  it("rejects an unexpected legacy fallback response", async () => {
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(onboardingResponse("live_draft"));

    await expect(saveAccountOnboarding(
      "account-1",
      { action: "set_intent", intent: "both" },
      fetcher,
    )).rejects.toThrow("Sunday Games is finishing an update. Try again.");
  });

  it("accepts an immutable completed response from another tab", async () => {
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(
      onboardingResponse("live_draft", "complete"),
    );

    await expect(saveAccountOnboarding(
      "account-1",
      { action: "set_intent", intent: "both" },
      fetcher,
    )).resolves.toMatchObject({ onboarding: { stage: "complete" } });
  });

  it("keeps the existing wire format for single-purpose intents", async () => {
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(onboardingResponse("live_draft"));

    await saveAccountOnboarding(
      "account-1",
      { action: "set_intent", intent: "live_draft" },
      fetcher,
    );

    expect(fetcher.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({
      accountId: "account-1",
      action: "set_intent",
      intent: "live_draft",
    }));
  });
});
