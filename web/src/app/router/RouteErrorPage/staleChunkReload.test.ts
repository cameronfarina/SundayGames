import { describe, expect, it, vi } from "vitest";
import { isStaleChunkError, reloadOnceForStaleChunk } from "./staleChunkReload";

const fakeStorage = (initial?: string) => {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set("staleChunkReloadedAt", initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
};

describe("stale chunk detection", () => {
  it("recognizes the Chrome and Firefox failure message", () => {
    const chromeError = new TypeError(
      "Failed to fetch dynamically imported module: https://sundaygames.io/assets/playerNewsRoute-btdGVP8y.js",
    );
    expect(isStaleChunkError(chromeError)).toBe(true);
  });

  it("recognizes the Safari failure message", () => {
    expect(isStaleChunkError(new TypeError("Importing a module script failed."))).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isStaleChunkError(new Error("League failed to load."))).toBe(false);
    expect(isStaleChunkError("Failed to fetch dynamically imported module")).toBe(false);
  });
});

describe("reload once for stale chunk", () => {
  it("reloads and records the time on the first failure", () => {
    const storage = fakeStorage();
    const reload = vi.fn();

    expect(reloadOnceForStaleChunk(storage, () => 50_000, reload)).toBe(true);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.getItem("staleChunkReloadedAt")).toBe("50000");
  });

  it("does not reload again right after a reload", () => {
    const storage = fakeStorage("45000");
    const reload = vi.fn();

    expect(reloadOnceForStaleChunk(storage, () => 50_000, reload)).toBe(false);

    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads again once the loop window has passed", () => {
    const storage = fakeStorage("30000");
    const reload = vi.fn();

    expect(reloadOnceForStaleChunk(storage, () => 50_000, reload)).toBe(true);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.getItem("staleChunkReloadedAt")).toBe("50000");
  });

  it("reloads when the stored time is not a number", () => {
    const storage = fakeStorage("not-a-time");
    const reload = vi.fn();

    expect(reloadOnceForStaleChunk(storage, () => 50_000, reload)).toBe(true);

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
