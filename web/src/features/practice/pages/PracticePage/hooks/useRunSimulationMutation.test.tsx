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
    class FakeWorker {
      onerror: ((event: ErrorEvent) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      postMessage = vi.fn();
      terminate = vi.fn();
    }
    const workers: FakeWorker[] = [];
    class StubWorker extends FakeWorker {
      constructor() {
        super();
        workers.push(this);
      }
    }
    vi.stubGlobal("Worker", StubWorker);
    const fetcher = vi.fn<PlatformFetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        historyId: "history-1",
        requestId: "request-1",
        input: { runCount: 2, seedPrefix: "hook-test" },
        inputDigest: "digest-1",
      }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        historyId: "history-1",
        summary,
      })));
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
    await waitFor(() => { expect(workers[0]).toBeDefined(); });
    act(() => {
      workers[0]?.onmessage?.(new MessageEvent("message", {
        data: { type: "progress", progress: { completed: 1, total: 2 } },
      }));
    });
    await waitFor(() => { expect(result.current.progress).toEqual({ completed: 1, total: 2 }); });
    act(() => {
      workers[0]?.onmessage?.(new MessageEvent("message", {
        data: { type: "result", result: { runCount: 2, seedPrefix: "hook-test" } },
      }));
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

  it("cancels an unresolved launch when the practice view unmounts", async () => {
    const fetcher = vi.fn<PlatformFetch>((_path, init) => {
      if (init?.method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Simulation canceled.", "AbortError"));
        }, { once: true });
      });
    });
    vi.stubGlobal("fetch", fetcher);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(
      () => useRunSimulationMutation("season-1", "balanced"),
      { wrapper },
    );
    act(() => { result.current.mutation.mutate({ count: 2, note: "", strategy: "" }); });
    await waitFor(() => { expect(fetcher).toHaveBeenCalledOnce(); });

    unmount();

    await waitFor(() => { expect(fetcher).toHaveBeenCalledTimes(2); });
    expect(fetcher.mock.calls[1]?.[0]).toMatch(/^\/season-simulations\/requests\//u);
  });

  it("keeps the replacement launch active while the superseded launch exits", async () => {
    let launchCount = 0;
    const fetcher = vi.fn<PlatformFetch>((_path, init) => {
      if (init?.method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
      launchCount += 1;
      if (launchCount === 2) {
        return Promise.resolve(new Response(JSON.stringify({
          error: { code: "rate_limited", message: "Try later." },
        }), { status: 429 }));
      }
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Simulation canceled.", "AbortError"));
        }, { once: true });
      });
    });
    vi.stubGlobal("fetch", fetcher);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => useRunSimulationMutation("season-1", "balanced"),
      { wrapper },
    );

    let first: Promise<unknown> | undefined;
    let second: Promise<unknown> | undefined;
    act(() => {
      first = result.current.mutation.mutateAsync({ count: 2, note: "", strategy: "" });
    });
    await waitFor(() => { expect(fetcher).toHaveBeenCalledOnce(); });
    act(() => {
      second = result.current.mutation.mutateAsync({ count: 2, note: "", strategy: "" });
    });
    if (first === undefined || second === undefined) throw new Error("Expected both launches.");

    await expect(first).rejects.toMatchObject({ name: "AbortError" });
    await expect(second).rejects.toEqual(expect.objectContaining({ code: "rate_limited" }));
  });
});
