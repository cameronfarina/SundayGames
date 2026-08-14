import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { liveDraftEventsResponseSchema } from "../api/liveDraftSchemas";
import { FakeEventSource } from "../test/fakeEventSource";
import { liveRoom } from "../test/liveDraftFixtures";
import { useLiveDraftUpdates } from "./useLiveDraftUpdates";

const eventResult = (
  currentRevision: number,
  requiresSnapshot: boolean,
  withEvent: boolean,
) => liveDraftEventsResponseSchema.parse({
  events: {
    currentRevision,
    events: withEvent ? [{ event: "room.sale", revision: currentRevision }] : [],
    isStale: false,
    requiresSnapshot,
  },
}).events;
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  FakeEventSource.reset();
});
describe("useLiveDraftUpdates", () => {
  it("applies typed room events without recreating the subscription as revisions advance", () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    const refresh = vi.fn(() => Promise.resolve());
    const applyRoomUpdate = vi.fn(() => true);
    const { result, rerender, unmount } = renderHook(({ revision }) => useLiveDraftUpdates({
      applyRoomUpdate,
      refresh,
      revision,
      roomId: "room/1",
    }), { initialProps: { revision: 4 } });
    const source = FakeEventSource.latest;
    if (source === undefined) throw new Error("Expected a live draft subscription.");

    expect(source.url).toBe("/live-rooms/room%2F1/event-stream?afterRevision=4");
    act(() => { source.onopen?.(new Event("open")); });
    expect(result.current).toBe("connected");
    const updatedRoom = { ...liveRoom, roomId: "room/1", revision: 5 };
    act(() => { source.emit("room.sale", updatedRoom); });
    expect(applyRoomUpdate).toHaveBeenCalledExactlyOnceWith("room.sale", updatedRoom);
    expect(refresh).not.toHaveBeenCalled();

    rerender({ revision: 5 });
    expect(FakeEventSource.created).toBe(1);
    expect(source.close).not.toHaveBeenCalled();
    act(() => { source.onerror?.(new Event("error")); });
    expect(result.current).toBe("reconnecting");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => { source.onerror?.(new Event("error")); });
    expect(result.current).toBe("offline");
    act(() => { window.dispatchEvent(new Event("offline")); });
    expect(result.current).toBe("offline");
    act(() => { window.dispatchEvent(new Event("online")); });
    expect(refresh).not.toHaveBeenCalled();
    unmount();
    expect(source.close).toHaveBeenCalledOnce();
  });
  it("refetches for invalid payloads and revision gaps", () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    const refresh = vi.fn(() => Promise.resolve());
    const applyRoomUpdate = vi.fn(() => false);
    renderHook(() => useLiveDraftUpdates({
      applyRoomUpdate,
      refresh,
      revision: 4,
      roomId: "room-1",
    }));
    const source = FakeEventSource.latest;
    if (source === undefined) throw new Error("Expected a live draft subscription.");

    act(() => { source.emitRaw("room.sale", "{"); });
    expect(refresh).toHaveBeenCalledOnce();
    expect(applyRoomUpdate).not.toHaveBeenCalled();

    act(() => { source.emitRaw("room.sale", "{}"); });
    act(() => { source.emitEvent("room.sale", new Event("room.sale")); });
    act(() => { source.emitEvent("room.unknown", new Event("room.unknown")); });
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(applyRoomUpdate).not.toHaveBeenCalled();

    act(() => { source.emit("room.sale", { ...liveRoom, revision: 6 }); });
    expect(applyRoomUpdate).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledTimes(4);
  });
  it("polls when EventSource is unavailable", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("EventSource", undefined);
    const refresh = vi.fn(() => Promise.resolve());
    const pollEvents = vi.fn()
      .mockResolvedValueOnce(eventResult(5, true, false))
      .mockResolvedValueOnce(eventResult(5, false, false))
      .mockResolvedValueOnce(eventResult(4, false, true))
      .mockResolvedValueOnce(eventResult(4, false, false));
    const { result, rerender, unmount } = renderHook(({ revision }) => useLiveDraftUpdates({
      applyRoomUpdate: vi.fn(() => true),
      pollEvents,
      refresh,
      revision,
      roomId: "room-1",
    }), { initialProps: { revision: 4 } });

    expect(result.current).toBe("polling");
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(pollEvents).toHaveBeenCalledExactlyOnceWith("room-1", 4, expect.any(Object));
    expect(refresh).toHaveBeenCalledOnce();
    rerender({ revision: 5 });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(pollEvents).toHaveBeenCalledTimes(4);
    expect(pollEvents).toHaveBeenLastCalledWith("room-1", 5, expect.any(Object));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports polling failures using the browser connection state", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("EventSource", undefined);
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const pollEvents = vi.fn(() => Promise.reject(new Error("offline")));
    const { result } = renderHook(() => useLiveDraftUpdates({
      applyRoomUpdate: vi.fn(() => true),
      pollEvents,
      refresh: vi.fn(() => Promise.resolve()),
      revision: 4,
      roomId: "room-1",
    }));

    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(result.current).toBe("reconnecting");
    online.mockReturnValue(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(result.current).toBe("offline");
  });

  it("stays unavailable before a room has loaded", () => {
    const refresh = vi.fn(() => Promise.resolve());
    const applyRoomUpdate = vi.fn(() => true);
    const { result } = renderHook(() => useLiveDraftUpdates({ applyRoomUpdate, refresh }));
    expect(result.current).toBe("unavailable");
    const { result: roomOnlyResult } = renderHook(() =>
      useLiveDraftUpdates({ applyRoomUpdate, refresh, roomId: "room-1" }));
    expect(roomOnlyResult.current).toBe("unavailable");
  });
});
