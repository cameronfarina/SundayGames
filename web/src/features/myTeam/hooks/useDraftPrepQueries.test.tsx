import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { useDraftPlanQuery, useSimulationHistoryQuery } from "./useDraftPrepQueries";

const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const requestUrl = (input: RequestInfo | URL): string => input instanceof Request
  ? input.url
  : input instanceof URL ? input.href : input;

describe("draft prep queries", () => {
  it("loads the shared Practice plan and simulation history", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      return Promise.resolve(url.startsWith("/practice-shortlist")
        ? new Response(JSON.stringify({ items: [] }))
        : new Response(JSON.stringify({ history: [] })));
    }));
    const { result } = renderHook(() => ({
      history: useSimulationHistoryQuery("season-2026"),
      plan: useDraftPlanQuery("season-2026"),
    }), { wrapper });
    await waitFor(() => { expect(result.current.plan.isSuccess).toBe(true); });
    await waitFor(() => { expect(result.current.history.isSuccess).toBe(true); });
    expect(result.current.plan.data).toEqual([]);
    expect(result.current.history.data).toEqual([]);
  });

  it("does not request private prep without a season", () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => ({
      history: useSimulationHistoryQuery(undefined),
      plan: useDraftPlanQuery(undefined),
    }), { wrapper });
    expect(result.current.plan.fetchStatus).toBe("idle");
    expect(result.current.history.fetchStatus).toBe("idle");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
