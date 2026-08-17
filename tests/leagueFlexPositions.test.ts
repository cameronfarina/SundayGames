import { describe, expect, it } from "vitest";
import { flexEligiblePositions } from "../src/platform/leagueCreation/flexPositions.js";

describe("league flex positions", () => {
  it("reads a standard flex as running back, receiver, and tight end", () => {
    expect(flexEligiblePositions({ QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, DST: 1, K: 1, BENCH: 7 }))
      .toEqual(["RB", "WR", "TE"]);
  });

  it("adds the quarterback in a superflex league", () => {
    expect(flexEligiblePositions({ QB: 1, RB: 2, WR: 2, TE: 1, SUPERFLEX: 1, BENCH: 7 }))
      .toEqual(["QB", "RB", "WR", "TE"]);
  });

  it("ignores the bench, which accepts every position without being a flex", () => {
    expect(flexEligiblePositions({ QB: 1, RB: 2, WR: 2, TE: 1, BENCH: 7 })).toEqual([]);
  });

  it("merges every flexible starting slot a league configures", () => {
    expect(flexEligiblePositions({ QB: 1, RB: 2, WR: 2, TE: 1, RB_WR: 1, SUPERFLEX: 1, BENCH: 5 }))
      .toEqual(["QB", "RB", "WR", "TE"]);
  });

  it("keeps a narrow flex narrow", () => {
    expect(flexEligiblePositions({ QB: 1, RB: 2, WR: 2, TE: 1, WR_TE: 1, BENCH: 6 }))
      .toEqual(["WR", "TE"]);
  });

  it("ignores slots a league sets to zero or leaves unknown", () => {
    expect(flexEligiblePositions({ RB: 2, WR: 2, FLEX: 0, MYSTERY: 3 })).toEqual([]);
  });
});
