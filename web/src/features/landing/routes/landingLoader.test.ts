import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import type { AuthSession } from "../../auth/api/authSchemas";
import { createLandingLoader } from "./landingLoader";

const session: AuthSession = {
  account: {
    createdAt: "2026-08-13T12:00:00.000Z",
    email: "user@example.com",
    id: "account-1",
    updatedAt: "2026-08-13T12:00:00.000Z",
  },
};

const runLoader = async (loadSession: () => Promise<AuthSession>) =>
  await createLandingLoader(new QueryClient(), loadSession)();

const locationOf = (result: Response | null): string | null =>
  result instanceof Response ? result.headers.get("location") : null;

describe("createLandingLoader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the real session endpoint when no reader is supplied", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: "unauthorized", message: "Unauthorized" } }),
      { headers: { "content-type": "application/json" }, status: 401 },
    )));

    const result = await createLandingLoader(new QueryClient())();

    expect(result).toBeNull();
  });

  it("sends a signed-in visitor to the product instead of the pitch", async () => {
    const result = await runLoader(async () => await Promise.resolve(session));

    expect(locationOf(result)).toBe("/practice");
  });

  it("shows the landing page when nobody is signed in", async () => {
    const result = await runLoader(async () => await Promise.reject(new PlatformApiError({
      code: "unauthorized",
      message: "Unauthorized",
      status: 401,
    })));

    expect(result).toBeNull();
  });

  it("still shows the landing page when the session cannot be read at all", async () => {
    const result = await runLoader(async () => await Promise.reject(new Error("offline")));

    expect(result).toBeNull();
  });
});
