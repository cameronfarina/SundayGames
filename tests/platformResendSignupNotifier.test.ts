import { describe, expect, it, vi } from "vitest";
import { createResendSignupNotifier } from "../src/platform/resendSignupNotifier.js";

describe("Resend signup notifier", () => {
  it("sends the signup email to the configured owner address", async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetcher: typeof fetch = vi.fn(async (input, init) => {
      requests.push({ url: String(input), init });
      return new Response(null, { status: 202 });
    });
    const notifier = createResendSignupNotifier({
      apiKey: "resend-secret",
      from: "Sunday Games <accounts@updates.sundaygames.io>",
      to: "owner@example.com",
      fetcher,
    });

    await notifier.notify({ email: "new.user@example.com", signedUpAt: new Date("2026-08-19T12:00:00.000Z") });

    expect(fetcher).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({
      method: "POST",
      headers: {
        authorization: "Bearer resend-secret",
        "content-type": "application/json",
      },
    }));
    const request = requests[0];
    expect(request?.url).not.toContain("resend-secret");
    expect(JSON.parse(String(request?.init?.body))).toMatchObject({
      from: "Sunday Games <accounts@updates.sundaygames.io>",
      to: ["owner@example.com"],
      subject: "New Sunday Games signup",
      text: "new.user@example.com signed up at 2026-08-19T12:00:00.000Z.",
    });
  });

  it("fails closed without exposing provider response content", async () => {
    const notifier = createResendSignupNotifier({
      apiKey: "resend-secret",
      from: "accounts@updates.sundaygames.io",
      to: "owner@example.com",
      fetcher: async () => new Response("provider included sensitive content", { status: 400 }),
    });

    await expect(notifier.notify({ email: "new.user@example.com", signedUpAt: new Date() }))
      .rejects.toThrow("Signup notification delivery failed with status 400.");
  });
});
