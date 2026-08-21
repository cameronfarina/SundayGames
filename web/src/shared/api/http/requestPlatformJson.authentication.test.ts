import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { authenticationRequiredEvent, requestPlatformJson } from "./requestPlatformJson";

describe("requestPlatformJson authentication events", () => {
  it("does not announce an expired session for invalid login credentials", async () => {
    const authenticationRequired = vi.fn();
    window.addEventListener(authenticationRequiredEvent, authenticationRequired);
    const fetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      error: { code: "invalid_credentials", message: "Email or password is incorrect." },
    }), { status: 401 })));

    try {
      await expect(requestPlatformJson({
        fetcher,
        path: "/sessions",
        responseSchema: z.object({}),
      })).rejects.toMatchObject({ code: "invalid_credentials", status: 401 });
      expect(authenticationRequired).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(authenticationRequiredEvent, authenticationRequired);
    }
  });
});
