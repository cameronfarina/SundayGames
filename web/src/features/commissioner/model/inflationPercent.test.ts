import { describe, expect, it } from "vitest";
import { inflationPercentError, savedInflationPercent } from "./inflationPercent";

describe("savedInflationPercent", () => {
  it("reads a stored multiplier back as a percentage", () => {
    expect(savedInflationPercent(1.2)).toBe("120");
  });

  it("rounds a multiplier that does not land on a whole percent", () => {
    expect(savedInflationPercent(1.235)).toBe("124");
  });

  it("shows nothing when a league has set no percentage", () => {
    expect(savedInflationPercent(undefined)).toBe("");
  });
});

describe("inflationPercentError", () => {
  it("accepts a whole percentage a league could be paying", () => {
    expect(inflationPercentError("120")).toBeUndefined();
    expect(inflationPercentError(" 1 ")).toBeUndefined();
    expect(inflationPercentError("1000")).toBeUndefined();
  });

  it("rejects a percentage outside what a league could be paying", () => {
    expect(inflationPercentError("0")).toBe("Enter a whole percentage from 1 to 1000.");
    expect(inflationPercentError("-5")).toBeDefined();
    expect(inflationPercentError("1001")).toBeDefined();
  });

  it("rejects a fraction of a percent and anything unreadable", () => {
    expect(inflationPercentError("120.5")).toBeDefined();
    expect(inflationPercentError("lots")).toBeDefined();
  });

  it("treats an empty box as no percentage rather than a mistake", () => {
    expect(inflationPercentError("   ")).toBeUndefined();
  });
});
