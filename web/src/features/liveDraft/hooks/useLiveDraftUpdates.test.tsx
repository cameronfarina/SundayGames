import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { liveDraftEventsResponseSchema } from "../api/liveDraftSchemas";
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

class FakeEventSource {
  static latest: FakeEventSource | undefined;
  readonly url: string;
  readonly listeners = new Map<string, EventListenerOrEventListenerObject[]>();
  onerror: ((event: Event) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;
  readonly close = vi.fn();

  constructor(url: string | URL) {
    this.url = String(url);
    FakeEventSource.latest = this;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const listeners = this.listeners.get(type) ?? [];
    this.listeners.set(type, [...listeners, listener]);
  }

  emit(type: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === "function") listener(new Event(type));
      else listener.handleEvent(new Event(type));
    }
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  FakeEventSource.latest = undefined;
});

describe("useLiveDraftUpdates", () => {
  it("subscribes after the current revision and refreshes on room events", () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    const refresh = vi.fn(() => Promise.resolve());
    const { result, unmount } = renderHook(() => useLiveDraftUpdates({
      refresh,
      revision: 4,
      roomId: "room/1",
    }));
    const source = FakeEventSource.latest;
    if (source === undefined) throw new Error("Expected a live draft subscription.");

    expect(source.url).toBe("/live-rooms/room%2F1/event-stream?afterRevision=4");
    act(() => { source.onopen?.(new Event("open")); });
    expect(result.current).toBe("connected");
    act(() => { source.emit("room.sale"); });
    expect(refresh).toHaveBeenCalledOnce();
    act(() => { source.onerror?.(new Event("error")); });
    expect(result.current).toBe("reconnecting");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => { source.onerror?.(new Event("error")); });
    expect(result.current).toBe("offline");
    act(() => { window.dispatchEvent(new Event("offline")); });
    expect(result.current).toBe("offline");
    act(() => { window.dispatchEvent(new Event("online")); });
    expect(refresh).toHaveBeenCalledTimes(2);
    unmount();
    expect(source.close).toHaveBeenCalledOnce();
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
    const { result, unmount } = renderHook(() => useLiveDraftUpdates({
      pollEvents,
      refresh,
      revision: 4,
      roomId: "room-1",
    }));

    expect(result.current).toBe("polling");
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(pollEvents).toHaveBeenCalledExactlyOnceWith("room-1", 4, expect.any(Object));
    expect(refresh).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(pollEvents).toHaveBeenCalledTimes(4);
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
    const { result } = renderHook(() => useLiveDraftUpdates({ refresh }));
    expect(result.current).toBe("unavailable");
    const { result: roomOnlyResult } = renderHook(() =>
      useLiveDraftUpdates({ refresh, roomId: "room-1" }));
    expect(roomOnlyResult.current).toBe("unavailable");
  });
});
