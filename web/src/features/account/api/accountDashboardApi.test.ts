import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import { getAccountDashboard } from "./accountDashboardApi";

const response = (body: unknown): Response => new Response(JSON.stringify(body), {
  headers: { "content-type": "application/json" },
});

afterEach(() => { vi.unstubAllGlobals(); });

describe("getAccountDashboard", () => {
  it("loads every league summary for the signed-in account", async () => {
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(response({ leagues: [] }));
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();

    await expect(getAccountDashboard(controller.signal)).resolves.toEqual({ leagues: [] });
    expect(fetcher).toHaveBeenCalledWith("/account-dashboard", expect.objectContaining({
      signal: controller.signal,
    }));
  });

  it("uses the default request when no abort signal is needed", async () => {
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(response({ leagues: [] }));
    vi.stubGlobal("fetch", fetcher);

    await getAccountDashboard();

    expect(fetcher.mock.calls[0]?.[1]).not.toHaveProperty("signal");
  });
});
