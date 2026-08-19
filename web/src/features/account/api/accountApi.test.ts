import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import { updateDisplayName } from "./accountApi";

const account = {
  createdAt: "2026-08-13T12:00:00.000Z",
  email: "cam@example.com",
  id: "account-cam",
  updatedAt: "2026-08-13T12:00:00.000Z",
};

const jsonResponse = (body: unknown, status = 200): Response => new Response(
  JSON.stringify(body),
  { headers: { "content-type": "application/json" }, status },
);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("updateDisplayName", () => {
  it("puts the new name and returns the saved account", async () => {
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(
      jsonResponse({ account: { ...account, displayName: "Cam Farina" } }),
    );
    vi.stubGlobal("fetch", fetcher);

    await expect(updateDisplayName({ displayName: "Cam Farina" }))
      .resolves.toMatchObject({ displayName: "Cam Farina" });

    expect(fetcher).toHaveBeenCalledWith("/session/profile", expect.objectContaining({
      body: JSON.stringify({ displayName: "Cam Farina" }),
      method: "PUT",
    }));
  });

  it("passes an abort signal through when it is given one", async () => {
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(jsonResponse({ account }));
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();

    await updateDisplayName({ displayName: "", signal: controller.signal });

    expect(fetcher).toHaveBeenCalledWith("/session/profile", expect.objectContaining({
      signal: controller.signal,
    }));
  });

  it("raises the server's error code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      error: { code: "invalid_display_name", message: "Display name is too long." },
    }, 400)));

    await expect(updateDisplayName({ displayName: "x".repeat(80) }))
      .rejects.toThrow(PlatformApiError);
  });
});
