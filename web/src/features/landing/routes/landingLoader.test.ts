import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLandingLoader } from "./landingLoader";

const runLoader = async (loadSessionState: () => Promise<boolean>) =>
  await createLandingLoader(new QueryClient(), loadSessionState)();

const locationOf = (result: Response | null): string | null =>
  result instanceof Response ? result.headers.get("location") : null;

describe("createLandingLoader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the real endpoint when no reader is supplied", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ signedIn: false }),
      { headers: { "content-type": "application/json" }, status: 200 },
    )));

    const result = await createLandingLoader(new QueryClient())();

    expect(result).toBeNull();
  });

  it("sends a signed-in visitor to the product instead of the pitch", async () => {
    const result = await runLoader(async () => await Promise.resolve(true));

    expect(locationOf(result)).toBe("/practice");
  });

  it("shows the landing page when nobody is signed in", async () => {
    const result = await runLoader(async () => await Promise.resolve(false));

    expect(result).toBeNull();
  });

  it("still shows the landing page when the check cannot be made at all", async () => {
    const result = await runLoader(async () => await Promise.reject(new Error("offline")));

    expect(result).toBeNull();
  });
});
