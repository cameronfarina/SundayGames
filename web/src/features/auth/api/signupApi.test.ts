import { describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import { createAccount, getSignupConfiguration } from "./signupApi";

const jsonResponse = (body: unknown, status = 200): Response => new Response(
  JSON.stringify(body),
  { headers: { "content-type": "application/json" }, status },
);

describe("signup API", () => {
  it("supports immediate and verification-required signup responses", async () => {
    const fetcher = vi.fn<PlatformFetch>()
      .mockResolvedValueOnce(jsonResponse({
        account: {
          createdAt: "2026-08-13T12:00:00.000Z",
          email: "cam@example.com",
          id: "account-cam",
          updatedAt: "2026-08-13T12:00:00.000Z",
        },
      }, 201))
      .mockResolvedValueOnce(jsonResponse({
        accepted: true,
        message: "Check your email for a verification link to finish your account.",
      }, 202));

    await expect(createAccount({
      email: "cam@example.com",
      fetcher,
      invitationToken: "invite-token",
      password: "secure password1!",
      returnTo: "/invite?token=invite-token",
    })).resolves.toMatchObject({ account: { id: "account-cam" } });
    await expect(createAccount({
      email: "new@example.com",
      fetcher,
      returnTo: "/practice",
    })).resolves.toMatchObject({ accepted: true });
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({
      email: "cam@example.com",
      invitationToken: "invite-token",
      password: "secure password1!",
      returnTo: "/invite?token=invite-token",
    }));
  });

  it("reads the server signup mode", async () => {
    const fetcher = vi.fn<PlatformFetch>()
      .mockResolvedValueOnce(jsonResponse({ passwordRequired: false }))
      .mockResolvedValueOnce(jsonResponse({ passwordRequired: true }));

    await expect(getSignupConfiguration({ fetcher })).resolves.toEqual({ passwordRequired: false });
    await expect(getSignupConfiguration({ fetcher })).resolves.toEqual({ passwordRequired: true });
    expect(fetcher).toHaveBeenNthCalledWith(
      1, "/accounts", expect.objectContaining({ method: "GET" }),
    );
  });
});
