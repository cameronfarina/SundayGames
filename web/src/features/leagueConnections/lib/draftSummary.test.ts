import { describe, expect, it } from "vitest";
import type { SyncedLeague } from "../api/leagueConnectionsSchema";
import { draftSummary, keeperSummary } from "./draftSummary";

const settings = (
  overrides: Partial<SyncedLeague["settings"]>,
): SyncedLeague["settings"] => ({
  name: "League",
  season: "2026",
  teamCount: 12,
  rosterPositions: ["QB"],
  scoring: {},
  ...overrides,
});

describe("draftSummary", () => {
  it("names an auction with the money that shapes it", () => {
    expect(draftSummary(settings({
      auctionBudget: 200,
      draftType: "auction",
      minimumBid: 2,
    }))).toBe("Auction · $200 budget · $2 minimum bid");
  });

  it("says only what the provider sent", () => {
    expect(draftSummary(settings({ draftType: "auction" }))).toBe("Auction");
    expect(draftSummary(settings({ draftType: "snake" }))).toBe("Snake");
  });

  it("counts the rounds of a snake draft", () => {
    expect(draftSummary(settings({ draftType: "snake", snakeRounds: 15 })))
      .toBe("Snake · 15 rounds");
  });

  it("stays quiet when the draft type never arrived", () => {
    expect(draftSummary(settings({}))).toBeUndefined();
  });
});

describe("keeperSummary", () => {
  it("treats no keepers and no answer alike", () => {
    expect(keeperSummary(undefined)).toBeUndefined();
    expect(keeperSummary(0)).toBeUndefined();
  });

  it("counts keepers per team", () => {
    expect(keeperSummary(1)).toBe("1 keeper per team");
    expect(keeperSummary(3)).toBe("3 keepers per team");
  });
});
