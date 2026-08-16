import { afterEach, describe, expect, it, vi } from "vitest";
import { formatNewsTimestamp } from "./formatNewsTimestamp";

describe("formatNewsTimestamp", () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it("formats news dates without seconds", () => {
    vi.stubEnv("TZ", "America/New_York");
    expect(formatNewsTimestamp("2026-08-16T21:19:00.000Z")).toBe("8/16/2026, 5:19pm");
  });

  it("omits missing or invalid dates", () => {
    expect(formatNewsTimestamp(undefined)).toBeUndefined();
    expect(formatNewsTimestamp("not-a-date")).toBeUndefined();
  });
});
