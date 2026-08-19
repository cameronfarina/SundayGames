import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { liveDraftAdvisoryQueryKey, useLiveDraftAdvisory } from "./useLiveDraftAdvisory";

const advisoryBody = {
  configured: true,
  basis: "ros",
  week: 4,
  players: [{ normalizedPlayerName: "Puka Nacua", rankEcr: 3, momentum: "rising", ecrDelta: 4 }],
};

const wrapper = ({ children }: PropsWithChildren) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("liveDraftAdvisoryQueryKey", () => {
  it("scopes the cache entry to the room", () => {
    expect(liveDraftAdvisoryQueryKey("room-1")).toEqual(["live-draft-advisory", "room-1"]);
  });
});

describe("useLiveDraftAdvisory", () => {
  it("returns the advisory once it loads", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify(advisoryBody), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))));

    const { result } = renderHook(() => useLiveDraftAdvisory("room-1"), { wrapper });

    await waitFor(() => { expect(result.current?.players).toHaveLength(1); });
    expect(result.current?.basis).toBe("ros");
    vi.unstubAllGlobals();
  });

  it("stays undefined when the advisory request fails so the room keeps working", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(
      JSON.stringify({ error: { code: "membership_required", message: "Join first." } }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    ))));

    const { result } = renderHook(() => useLiveDraftAdvisory("room-1"), { wrapper });

    await waitFor(() => { expect(globalThis.fetch).toHaveBeenCalled(); });
    expect(result.current).toBeUndefined();
    vi.unstubAllGlobals();
  });
});
