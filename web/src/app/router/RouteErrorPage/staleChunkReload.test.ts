import { describe, expect, it, vi } from "vitest";
import {
  isStaleChunkError,
  reloadOnceForStaleChunk,
  staleChunkReloadSignature,
} from "./staleChunkReload";

const fakeStorage = (initial?: string) => {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set("staleChunkReloadedFor", initial);
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

  it("recognizes a stylesheet removed by a newer deploy", () => {
    const stylesheetError = new TypeError(
      "Unable to preload CSS for https://sundaygames.io/assets/commissionerRoute-DywplrXn.css",
    );
    expect(isStaleChunkError(stylesheetError)).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isStaleChunkError(new Error("League failed to load."))).toBe(false);
    expect(isStaleChunkError("Failed to fetch dynamically imported module")).toBe(false);
  });
});

describe("reload once for stale chunk", () => {
  const firstAsset = "Unable to preload CSS for /assets/commissionerRoute-old.css";
  const nextAsset = "Unable to preload CSS for /assets/commissionerRoute-new.css";

  it("reloads and records the failed asset on the first failure", () => {
    const storage = fakeStorage();
    const reload = vi.fn();

    expect(reloadOnceForStaleChunk(firstAsset, storage, reload)).toBe(true);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.getItem("staleChunkReloadedFor")).toBe(firstAsset);
  });

  it("does not reload the same failed asset again", () => {
    const storage = fakeStorage(firstAsset);
    const reload = vi.fn();

    expect(reloadOnceForStaleChunk(firstAsset, storage, reload)).toBe(false);

    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads for a different asset from a later deploy", () => {
    const storage = fakeStorage(firstAsset);
    const reload = vi.fn();

    expect(reloadOnceForStaleChunk(nextAsset, storage, reload)).toBe(true);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.getItem("staleChunkReloadedFor")).toBe(nextAsset);
  });
});

describe("stale chunk reload signature", () => {
  it("distinguishes Safari failures from later application builds", () => {
    const error = new TypeError("Importing a module script failed.");

    expect(staleChunkReloadSignature(error, "/assets/index-old.js"))
      .not.toBe(staleChunkReloadSignature(error, "/assets/index-new.js"));
  });

  it("keeps a persistent failure stable within one application build", () => {
    const error = new TypeError("Importing a module script failed.");

    expect(staleChunkReloadSignature(error, "/assets/index-current.js"))
      .toBe(staleChunkReloadSignature(error, "/assets/index-current.js"));
  });
});
