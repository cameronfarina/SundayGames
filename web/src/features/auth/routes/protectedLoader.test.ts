import { QueryClient } from "@tanstack/react-query";
import type { LoaderFunctionArgs } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import { createProtectedLoader } from "./protectedLoader";

const loaderArgs = (path: string): LoaderFunctionArgs => ({
  context: {},
  params: {},
  request: new Request(`https://mockd.local${path}`),
  pattern: "/",
  url: new URL(`https://mockd.local${path}`),
});

describe("protected route loader", () => {
  it("reuses a cached session and allows the product route", async () => {
    const queryClient = new QueryClient();
    const loadSession = vi.fn().mockResolvedValue({ account: { id: "account-1" } });

    await expect(createProtectedLoader(queryClient, loadSession)(loaderArgs("/practice")))
      .resolves.toBeNull();
    await expect(createProtectedLoader(queryClient, loadSession)(loaderArgs("/league")))
      .resolves.toBeNull();
    expect(loadSession).toHaveBeenCalledOnce();
  });

  it("redirects signed-out users with a same-origin return path", async () => {
    const queryClient = new QueryClient();
    const loadSession = vi.fn().mockRejectedValue(new PlatformApiError({
      code: "authentication_required",
      message: "Sign in.",
      status: 401,
    }));

    const response = await createProtectedLoader(queryClient, loadSession)(
      loaderArgs("/league?seasonId=season-1"),
    );

    if (!(response instanceof Response)) throw new Error("Expected a redirect response.");
    expect(response.headers.get("location")).toBe(
      "/login?returnTo=%2Fleague%3FseasonId%3Dseason-1",
    );
  });

  it("preserves non-authentication failures for the route error boundary", async () => {
    const queryClient = new QueryClient();
    const failure = new Error("Session store unavailable.");
    const loadSession = vi.fn().mockRejectedValue(failure);

    await expect(createProtectedLoader(queryClient, loadSession)(loaderArgs("/practice")))
      .rejects.toBe(failure);
  });
});
