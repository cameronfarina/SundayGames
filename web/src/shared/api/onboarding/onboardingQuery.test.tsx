import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { onboardingQueryKey, onboardingQueryOptions, useOnboardingQuery } from "./onboardingQuery";

const responseBody = {
  account: { email: "user@example.com", id: "account-1" },
  leagues: [],
};

const response = (body: unknown): Response => new Response(JSON.stringify(body), {
  headers: { "content-type": "application/json" },
  status: 200,
});

const clientFor = () => new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("onboarding query", () => {
  it("deduplicates cached reads and refetches after canonical invalidation", async () => {
    const fetcher = vi.fn(() => Promise.resolve(response(responseBody)));
    vi.stubGlobal("fetch", fetcher);
    const queryClient = clientFor();

    await queryClient.fetchQuery(onboardingQueryOptions());
    await queryClient.fetchQuery(onboardingQueryOptions());
    expect(fetcher).toHaveBeenCalledOnce();

    await queryClient.invalidateQueries({ queryKey: onboardingQueryKey() });
    await queryClient.fetchQuery(onboardingQueryOptions());
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("exposes the canonical query through its React hook", async () => {
    const fetcher = vi.fn(() => Promise.resolve(response(responseBody)));
    const queryClient = clientFor();
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useOnboardingQuery(fetcher), { wrapper });

    await waitFor(() => { expect(result.current.data).toEqual(responseBody); });
    expect(result.current.dataUpdatedAt).toBeGreaterThan(0);
  });
});
