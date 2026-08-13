import { describe, expect, it, vi } from "vitest";
import { createAsyncValueCache } from "../src/platform/asyncValueCache.js";

describe("createAsyncValueCache", () => {
  it("shares one in-flight load and reuses the resolved immutable value", async () => {
    const value = Object.freeze({ players: 500 });
    const load = vi.fn(async () => value);
    const cached = createAsyncValueCache(load);

    const [first, second] = await Promise.all([cached(), cached()]);
    const third = await cached();

    expect(load).toHaveBeenCalledTimes(1);
    expect(first).toBe(value);
    expect(second).toBe(value);
    expect(third).toBe(value);
  });

  it("does not cache a failed load", async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error("temporary read failure"))
      .mockResolvedValueOnce("ready");
    const cached = createAsyncValueCache(load);

    await expect(cached()).rejects.toThrow("temporary read failure");
    await expect(cached()).resolves.toBe("ready");
    expect(load).toHaveBeenCalledTimes(2);
  });
});
