import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../../shared/api/http/requestPlatformJson";
import { practiceQueryKeys } from "./practiceQueryKeys";
import { useRunSimulationMutation } from "./useRunSimulationMutation";

afterEach(() => { vi.unstubAllGlobals(); });

const summary = {
  completedCount: 2,
  draftFormat: "auction",
  outcomes: [],
  playerExposure: [],
  positionCounts: {},
  runCount: 2,
  seedPrefix: "hook-test",
  strategy: { preferredPositions: [], rawInput: "", summary: "Balanced", warnings: [] },
};

describe("useRunSimulationMutation", () => {
  it("tracks streamed progress and caches the compact result", async () => {
    const encoder = new TextEncoder();
    let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { streamController = controller; },
    });
    const fetcher = vi.fn<PlatformFetch>().mockResolvedValue(new Response(stream));
    vi.stubGlobal("fetch", fetcher);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => useRunSimulationMutation("season-1", "balanced"),
      { wrapper },
    );

    let completion: Promise<unknown> | undefined;
    act(() => {
      completion = result.current.mutation.mutateAsync({ count: 2, note: "", strategy: "" });
    });
    await waitFor(() => { expect(result.current.progress).toEqual({ completed: 0, total: 2 }); });
    if (streamController === undefined) throw new Error("Expected an active simulation stream.");
    act(() => {
      streamController?.enqueue(encoder.encode(
        'event: progress\ndata: {"completed":1,"total":2}\n\n',
      ));
    });
    await waitFor(() => { expect(result.current.progress).toEqual({ completed: 1, total: 2 }); });
    act(() => {
      streamController?.enqueue(encoder.encode(
        `event: result\ndata: ${JSON.stringify({ historyId: "history-1", summary })}\n\n`,
      ));
      streamController?.close();
    });
    if (completion === undefined) throw new Error("Expected a simulation mutation promise.");
    await act(async () => { await completion; });

    expect(result.current.progress).toEqual({ completed: 2, total: 2 });
    expect(client.getQueryData(practiceQueryKeys.simulation("history-1")))
      .toEqual({ historyId: "history-1", summary });
  });

  it("clears progress after a failed request", async () => {
    vi.stubGlobal("fetch", vi.fn<PlatformFetch>().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "simulation_busy", message: "Busy." },
    }), { status: 409 })));
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => useRunSimulationMutation("season-1", "balanced"),
      { wrapper },
    );

    await act(async () => {
      await expect(result.current.mutation.mutateAsync({ count: 2, note: "", strategy: "" }))
        .rejects.toThrow("Busy.");
    });
    expect(result.current.progress).toBeUndefined();
  });
});
