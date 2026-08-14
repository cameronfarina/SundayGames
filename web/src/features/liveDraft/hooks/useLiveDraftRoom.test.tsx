import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { liveDraftRoomSchema, type LiveDraftRoom } from "../api/liveDraftSchemas";
import { FakeEventSource } from "../test/fakeEventSource";
import { liveRoom } from "../test/liveDraftFixtures";
import { liveDraftRoomQueryKey, useLiveDraftRoom } from "./useLiveDraftRoom";

afterEach(() => {
  vi.unstubAllGlobals();
  FakeEventSource.reset();
});

describe("useLiveDraftRoom", () => {
  it("guards mutations before the room loads and exposes refresh", async () => {
    const pendingResponse = new Promise<Response>(() => undefined);
    vi.stubGlobal("fetch", vi.fn(() => pendingResponse));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    const wrapper = ({ children }: { readonly children: ReactNode }) =>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { result, unmount } = renderHook(() => useLiveDraftRoom("room-1"), { wrapper });

    await expect(result.current.runAction({ action: "start" }))
      .rejects.toThrow("The draft room has not loaded yet.");
    await act(async () => { await result.current.refresh(); });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["live-draft-room", "room-1"] });
    unmount();
    queryClient.clear();
  });

  it("writes contiguous stream snapshots directly to the TanStack room cache", () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(liveDraftRoomQueryKey(liveRoom.roomId), liveRoom);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    const wrapper = ({ children }: { readonly children: ReactNode }) =>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { unmount } = renderHook(() => useLiveDraftRoom(liveRoom.roomId), { wrapper });
    const source = FakeEventSource.latest;
    if (source === undefined) throw new Error("Expected a live draft subscription.");
    const updatedRoom = liveDraftRoomSchema.parse({
      ...liveRoom,
      revision: 3,
      connection: { ...liveRoom.connection, cursor: "room-1:3", revision: 3 },
    });

    act(() => { source.emit("room.sale", updatedRoom); });
    expect(queryClient.getQueryData<LiveDraftRoom>(liveDraftRoomQueryKey(liveRoom.roomId)))
      .toEqual(updatedRoom);
    expect(invalidate).not.toHaveBeenCalled();
    expect(FakeEventSource.created).toBe(1);

    const gapRoom = liveDraftRoomSchema.parse({
      ...updatedRoom,
      revision: 5,
      connection: { ...updatedRoom.connection, cursor: "room-1:5", revision: 5 },
    });
    act(() => { source.emit("room.sale", gapRoom); });
    expect(invalidate).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData<LiveDraftRoom>(liveDraftRoomQueryKey(liveRoom.roomId)))
      .toEqual(updatedRoom);

    unmount();
    queryClient.clear();
  });
});
