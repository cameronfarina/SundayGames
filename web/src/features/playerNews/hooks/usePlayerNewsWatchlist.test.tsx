import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePlayerNewsWatchlist } from "./usePlayerNewsWatchlist";

describe("usePlayerNewsWatchlist", () => {
  afterEach(() => { localStorage.clear(); });

  it("persists followed players for the current account", () => {
    const { result, unmount } = renderHook(() => usePlayerNewsWatchlist("account-1"));
    act(() => { result.current.toggle("De'Von Achane"); });
    expect(result.current.isFollowed("De'Von Achane")).toBe(true);
    unmount();

    const view = renderHook(() => usePlayerNewsWatchlist("account-1"));
    expect(view.result.current.players).toEqual(["De'Von Achane"]);
    act(() => { view.result.current.toggle("De'Von Achane"); });
    expect(view.result.current.players).toEqual([]);
  });

  it("isolates lists by account and ignores invalid storage", () => {
    localStorage.setItem("mockd:player-news:my-players:account-2", "invalid");
    const view = renderHook(() => usePlayerNewsWatchlist("account-2"));
    expect(view.result.current.players).toEqual([]);
  });

  it("ignores saved data with the wrong shape", () => {
    localStorage.setItem("mockd:player-news:my-players:account-3", JSON.stringify({ player: "De'Von Achane" }));
    const view = renderHook(() => usePlayerNewsWatchlist("account-3"));
    expect(view.result.current.players).toEqual([]);
  });

  it("keeps the in-memory list when browser storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("unavailable"); });
    const view = renderHook(() => usePlayerNewsWatchlist("account-4"));
    act(() => { view.result.current.toggle("Ladd McConkey"); });
    expect(view.result.current.players).toEqual(["Ladd McConkey"]);
    vi.restoreAllMocks();
  });
});
