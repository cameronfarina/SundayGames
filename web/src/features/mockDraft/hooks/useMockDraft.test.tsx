import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { auctionMockResponseFixture } from "../test/auctionMockResponseFixture.js";
import { useMockDraft } from "./useMockDraft.js";

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  headers: { "content-type": "application/json" },
  status,
});

const wrapperFor = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { readonly children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe("useMockDraft", () => {
  it("creates, commands, and abandons one cache-owned session", async () => {
    const body = auctionMockResponseFixture();
    const abandoned = { mockSession: { ...body.mockSession, status: "abandoned" } };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(body, 201))
      .mockResolvedValueOnce(jsonResponse(body))
      .mockResolvedValueOnce(jsonResponse(abandoned));
    const onSessionChange = vi.fn();
    const { result } = renderHook(() => useMockDraft({
      fetcher,
      onSessionChange,
      seasonId: "season-1",
      strategy: "balanced",
    }), { wrapper: wrapperFor() });

    expect(result.current.response).toBeUndefined();
    await act(async () => { await result.current.create(); });
    expect(result.current.response).toEqual(body);
    expect(result.current.activeSessionId).toBe("mock-1");
    expect(onSessionChange).toHaveBeenCalledWith("mock-1");

    await act(async () => { await result.current.command({ type: "buy", price: 72 }); });
    expect(result.current.response).toEqual(body);
    await act(async () => { await result.current.abandon(); });
    expect(result.current.response).toBeUndefined();
    expect(result.current.abandoned).toBe(true);
    expect(onSessionChange).toHaveBeenLastCalledWith(undefined);
  });

  it("resumes an existing session and reports request failures", async () => {
    const body = auctionMockResponseFixture();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(body))
      .mockResolvedValueOnce(jsonResponse({ error: { code: "stale_revision", message: "Reload." } }, 409));
    const { result } = renderHook(() => useMockDraft({
      fetcher,
      initialSessionId: "mock-1",
      seasonId: "season-1",
      strategy: "balanced",
    }), { wrapper: wrapperFor() });

    await waitFor(() => { expect(result.current.response).toEqual(body); });
    await act(async () => {
      await expect(result.current.command({ type: "pass" })).rejects.toMatchObject({
        code: "stale_revision",
      });
    });
    await waitFor(() => {
      expect(result.current.error).toMatchObject({ code: "stale_revision" });
    });
  });

  it("rejects commands and abandonment before a session exists", async () => {
    const { result } = renderHook(() => useMockDraft({
      fetcher: vi.fn(),
      seasonId: "season-1",
      strategy: "balanced",
    }), { wrapper: wrapperFor() });

    await act(async () => {
      await expect(result.current.command({ type: "start" })).rejects.toThrow("No mock session is active.");
      await expect(result.current.abandon()).rejects.toThrow("No mock session is active.");
    });
  });

  it("rejects mutations while an existing session is still loading", async () => {
    const fetcher = vi.fn(() => new Promise<Response>(() => undefined));
    const { result } = renderHook(() => useMockDraft({
      fetcher,
      initialSessionId: "mock-loading",
      seasonId: "season-1",
      strategy: "balanced",
    }), { wrapper: wrapperFor() });

    await act(async () => {
      await expect(result.current.command({ type: "start" }))
        .rejects.toThrow("No mock session is active.");
      await expect(result.current.abandon()).rejects.toThrow("No mock session is active.");
    });
  });

  it("reports create and abandon request failures", async () => {
    const errorBody = { error: { code: "unavailable", message: "Try again." } };
    const createFailure = vi.fn().mockResolvedValue(jsonResponse(errorBody, 503));
    const { result: createResult, unmount } = renderHook(() => useMockDraft({
      fetcher: createFailure,
      seasonId: "season-1",
      strategy: "balanced",
    }), { wrapper: wrapperFor() });
    await act(async () => {
      await expect(createResult.current.create()).rejects.toMatchObject({ code: "unavailable" });
    });
    await waitFor(() => {
      expect(createResult.current.error).toMatchObject({ code: "unavailable" });
    });
    unmount();

    const body = auctionMockResponseFixture();
    const abandonFailure = vi.fn()
      .mockResolvedValueOnce(jsonResponse(body, 201))
      .mockResolvedValueOnce(jsonResponse(errorBody, 503));
    const { result: abandonResult } = renderHook(() => useMockDraft({
      fetcher: abandonFailure,
      seasonId: "season-1",
      strategy: "balanced",
    }), { wrapper: wrapperFor() });
    await act(async () => { await abandonResult.current.create(); });
    await act(async () => {
      await expect(abandonResult.current.abandon()).rejects.toMatchObject({ code: "unavailable" });
    });
    await waitFor(() => {
      expect(abandonResult.current.error).toMatchObject({ code: "unavailable" });
    });
  });

  it("uses the platform fetch default when none is provided", async () => {
    const { result } = renderHook(() => useMockDraft({
      seasonId: "season-1",
      strategy: "balanced",
    }), { wrapper: wrapperFor() });
    await act(async () => {
      await expect(result.current.command({ type: "start" })).rejects.toThrow(
        "No mock session is active.",
      );
    });
  });
});
