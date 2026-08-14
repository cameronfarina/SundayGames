import { describe, expect, it, vi } from "vitest";
import type { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import {
  changePassword,
  createAccount,
  getSession,
  login,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from "./authApi";

const jsonResponse = (body: unknown, status = 200): Response => new Response(
  JSON.stringify(body),
  { headers: { "content-type": "application/json" }, status },
);

describe("auth API", () => {
  it("accepts a login response whose token is held only in the HttpOnly cookie", async () => {
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(jsonResponse({
      account: {
        createdAt: "2026-08-13T12:00:00.000Z",
        email: "cam@example.com",
        id: "account-cam",
        updatedAt: "2026-08-13T12:00:00.000Z",
      },
      session: {
        accountId: "account-cam",
        createdAt: "2026-08-13T12:00:00.000Z",
        expiresAt: "2026-08-14T12:00:00.000Z",
        id: "session-1",
      },
    }));

    await expect(login({ email: "cam@example.com", fetcher, password: "secure password" }))
      .resolves.toMatchObject({ session: { id: "session-1" } });
  });

  it("loads and validates the current session", async () => {
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(jsonResponse({
      account: {
        createdAt: "2026-08-13T12:00:00.000Z",
        email: "cam@example.com",
        id: "account-cam",
        updatedAt: "2026-08-13T12:00:00.000Z",
      },
    }));

    await expect(getSession({ fetcher })).resolves.toMatchObject({
      account: { email: "cam@example.com" },
    });
    expect(fetcher).toHaveBeenCalledWith("/session", expect.objectContaining({ method: "GET" }));
  });

  it("preserves login errors and rejects malformed success data", async () => {
    const denied = vi.fn<PlatformFetch>().mockResolvedValue(jsonResponse({
      error: { code: "invalid_credentials", message: "Email or password is incorrect." },
    }, 401));
    await expect(login({ email: "cam@example.com", fetcher: denied, password: "wrong password" }))
      .rejects.toEqual(expect.objectContaining<Partial<PlatformApiError>>({
        code: "invalid_credentials",
      }));

    const malformed = vi.fn<PlatformFetch>().mockResolvedValue(jsonResponse({ account: {} }));
    await expect(login({ email: "cam@example.com", fetcher: malformed, password: "password" }))
      .rejects.toEqual(expect.objectContaining<Partial<PlatformApiError>>({ code: "invalid_response" }));
  });

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
        message: "If this email can be registered, a verification link is on its way.",
      }, 202));

    await expect(createAccount({
      email: "cam@example.com",
      fetcher,
      invitationToken: "invite-token",
      password: "secure password",
      returnTo: "/invite?token=invite-token",
    })).resolves.toMatchObject({ account: { id: "account-cam" } });
    await expect(createAccount({
      email: "new@example.com",
      fetcher,
      password: "secure password",
      returnTo: "/practice",
    })).resolves.toMatchObject({ accepted: true });
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({
      email: "cam@example.com",
      invitationToken: "invite-token",
      password: "secure password",
      returnTo: "/invite?token=invite-token",
    }));
  });

  it("covers verification and password recovery commands", async () => {
    const fetcher = vi.fn<PlatformFetch>()
      .mockResolvedValueOnce(jsonResponse({ verified: true }))
      .mockResolvedValueOnce(jsonResponse({ accepted: true, message: "Reset sent." }, 202))
      .mockResolvedValueOnce(jsonResponse({ reset: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(verifyEmail({ fetcher, token: "verify" })).resolves.toBe(true);
    await expect(requestPasswordReset({ email: "cam@example.com", fetcher }))
      .resolves.toBe("Reset sent.");
    await expect(resetPassword({
      fetcher,
      newPassword: "replacement password",
      newPasswordConfirmation: "replacement password",
      token: "reset",
    })).resolves.toBe(true);
    await expect(changePassword({
      currentPassword: "secure password",
      fetcher,
      newPassword: "replacement password",
      newPasswordConfirmation: "replacement password",
    })).resolves.toBe(true);
  });
});
