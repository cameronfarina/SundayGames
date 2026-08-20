import { describe, expect, it, vi } from "vitest";
import type { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import {
  changePassword,
  getSession,
  getSessionState,
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

    await expect(login({ email: "cam@example.com", fetcher, password: "secure password1!" }))
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

  it("answers whether a visitor is signed in without failing when they are not", async () => {
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(jsonResponse({ signedIn: false }));

    await expect(getSessionState({ fetcher })).resolves.toBe(false);
    expect(fetcher)
      .toHaveBeenCalledWith("/session-state", expect.objectContaining({ method: "GET" }));
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

  it("covers verification and password recovery commands", async () => {
    const fetcher = vi.fn<PlatformFetch>()
      .mockResolvedValueOnce(jsonResponse({ verified: true }))
      .mockResolvedValueOnce(jsonResponse({ accepted: true, message: "Reset sent." }, 202))
      .mockResolvedValueOnce(jsonResponse({ reset: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(verifyEmail({
      fetcher,
      token: "verify",
      newPassword: "mailbox proven password1!",
      newPasswordConfirmation: "mailbox proven password1!",
    })).resolves.toBe(true);
    await expect(requestPasswordReset({ email: "cam@example.com", fetcher }))
      .resolves.toBe("Reset sent.");
    await expect(resetPassword({
      fetcher,
      newPassword: "replacement password1!",
      newPasswordConfirmation: "replacement password1!",
      token: "reset",
    })).resolves.toBe(true);
    await expect(changePassword({
      currentPassword: "secure password1!",
      fetcher,
      newPassword: "replacement password1!",
      newPasswordConfirmation: "replacement password1!",
    })).resolves.toBe(true);
  });
});
