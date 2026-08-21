import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { accountDashboardQueryOptions } from "./accountDashboardQuery";

afterEach(() => { vi.unstubAllGlobals(); });

describe("accountDashboardQueryOptions", () => {
  it("shares one account-scoped cache entry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ leagues: [] }))));
    const options = accountDashboardQueryOptions();
    const client = new QueryClient();

    await expect(client.fetchQuery(options)).resolves.toEqual({ leagues: [] });
    expect(options.queryKey).toEqual(["account", "dashboard"]);
  });
});
