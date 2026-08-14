import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import { useSessionQuery } from "./sessionQuery";

const Wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe("useSessionQuery", () => {
  it("loads the signed-in account through the shared query contract", async () => {
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(new Response(JSON.stringify({
      account: {
        createdAt: "2026-08-13T12:00:00.000Z",
        email: "cam@example.com",
        id: "account-cam",
        updatedAt: "2026-08-13T12:00:00.000Z",
      },
    }), { status: 200 }));
    const { result } = renderHook(() => useSessionQuery(fetcher), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.account.email).toBe("cam@example.com");
  });

  it("uses the browser fetch implementation by default", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      account: {
        createdAt: "2026-08-13T12:00:00.000Z",
        email: "owner@example.com",
        id: "account-owner",
        updatedAt: "2026-08-13T12:00:00.000Z",
      },
    }), { status: 200 })));
    const { result } = renderHook(() => useSessionQuery(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.data?.account.email).toBe("owner@example.com");
    });
  });
});

afterEach(() => { vi.unstubAllGlobals(); });
