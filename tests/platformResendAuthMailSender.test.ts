import { describe, expect, it, vi } from "vitest";
import { createResendAuthMailSender } from "../src/platform/resendAuthMailSender.js";

describe("Resend auth mail sender", () => {
  it("sends credentials only in the authorization header", async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetcher: typeof fetch = vi.fn(async (input, init) => {
      requests.push({ url: String(input), init });
      return new Response(null, { status: 202 });
    });
    const sender = createResendAuthMailSender({
      apiKey: "resend-secret",
      from: "Mockd <accounts@mockd.example.com>",
      fetcher,
    });

    await sender.send({
      to: "owner@example.com",
      subject: "Verify your Mockd email",
      text: "Open the link.",
      actionUrl: "https://mockd.example.com/verify-email?token=mail-token",
    });

    expect(fetcher).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({
      method: "POST",
      headers: {
        authorization: "Bearer resend-secret",
        "content-type": "application/json",
      },
    }));
    const request = requests[0];
    expect(request).toBeDefined();
    expect(request?.url).not.toContain("resend-secret");
    expect(request?.url).not.toContain("mail-token");
    expect(JSON.parse(String(request?.init?.body))).toMatchObject({
      from: "Mockd <accounts@mockd.example.com>",
      to: ["owner@example.com"],
      subject: "Verify your Mockd email",
    });
  });

  it("fails closed without exposing provider response content", async () => {
    const sender = createResendAuthMailSender({
      apiKey: "resend-secret",
      from: "accounts@mockd.example.com",
      fetcher: async () => new Response("provider included sensitive content", { status: 400 }),
    });

    await expect(sender.send({
      to: "owner@example.com",
      subject: "Reset",
      text: "Reset link",
      actionUrl: "https://mockd.example.com/reset-password?token=secret-token",
    })).rejects.toThrow("Auth email delivery failed with status 400.");
  });
});
