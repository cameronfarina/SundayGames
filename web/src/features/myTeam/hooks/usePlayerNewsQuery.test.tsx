import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { playerNewsFeedFixture } from "../api/playerNews.fixture";
import { usePlayerNewsQuery } from "./usePlayerNewsQuery";

const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe("usePlayerNewsQuery", () => {
  it("loads and caches a season and source scoped feed", async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify(playerNewsFeedFixture))));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => usePlayerNewsQuery("season-2026", "all"), { wrapper });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(result.current.data?.summary.filteredCount).toBe(2);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("stays idle without an active season", () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => usePlayerNewsQuery(undefined, "local"), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
