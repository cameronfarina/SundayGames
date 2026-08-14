import { describe, expect, it } from "vitest";
import { keeperCost, keepers } from "../config/keepers.js";

describe("synthetic keepers", () => {
  it("keeps demonstration declarations internally consistent", () => {
    expect(keepers).toHaveLength(7);
    expect(keepers.every(keeper => /^Owner\d{2}$/u.test(keeper.owner))).toBe(true);
    expect(keepers.every(keeper => keeper.newCost === keeperCost(keeper.priorCost))).toBe(true);
    expect(keepers.some(keeper => keeper.status === "confirmed")).toBe(true);
    expect(keepers.some(keeper => keeper.status === "assumed")).toBe(true);
  });

  it("rounds a twenty-percent keeper increase up to a whole dollar", () => {
    expect(keeperCost(4)).toBe(5);
    expect(keeperCost(10)).toBe(12);
  });
});
