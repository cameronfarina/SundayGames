import { describe, expect, it } from "vitest";
import {
  espnPpr300AuctionBaseline2026,
  espnPpr300AuctionBaseline2026Source,
  espnPpr300AuctionBaselineValueFor,
} from "../src/data/espnPpr300AuctionBaseline2026.js";

describe("ESPN 2026 PPR Top 300 auction baseline", () => {
  it("publishes the scoring and roster assumptions attached to ESPN's values", () => {
    expect(espnPpr300AuctionBaseline2026Source).toEqual({
      provider: "ESPN",
      title: "2026 ESPN Fantasy Football Draft Kit - PPR Top 300 Cheat Sheet",
      url: "https://g.espncdn.com/s/ffldraftkit/26/NFL26_CS_PPR300.pdf?adddata=2026CS_PPR300",
      lastUpdated: "2026-08-13",
      scoring: "ppr",
      receptionPoints: 1,
      teamCount: 10,
      salaryCap: 200,
      roster: {
        QB: 1,
        RB: 2,
        WR: 2,
        TE: 1,
        FLEX: 1,
        K: 1,
        DST: 1,
        BENCH: 7,
      },
    });
    expect(Object.isFrozen(espnPpr300AuctionBaseline2026Source)).toBe(true);
    expect(Object.isFrozen(espnPpr300AuctionBaseline2026Source.roster)).toBe(true);
  });

  it("contains every unique overall rank from ESPN's Top 300", () => {
    expect(espnPpr300AuctionBaseline2026).toHaveLength(300);
    expect(espnPpr300AuctionBaseline2026.map(player => player.overallRank)).toEqual(
      Array.from({ length: 300 }, (_, index) => index + 1),
    );
    expect(new Set(espnPpr300AuctionBaseline2026.map(player => player.normalizedName)).size).toBe(300);
    expect(Object.isFrozen(espnPpr300AuctionBaseline2026)).toBe(true);
    expect(espnPpr300AuctionBaseline2026.every(Object.isFrozen)).toBe(true);
  });

  it("preserves ESPN values across all four printed ranking columns", () => {
    expect(espnPpr300AuctionBaselineValueFor("Jahmyr Gibbs")).toMatchObject({
      overallRank: 1,
      position: "RB",
      positionRank: 1,
      teamAbbreviation: "DET",
      auctionValue: 57,
      byeWeek: 6,
    });
    expect(espnPpr300AuctionBaselineValueFor("Brian Thomas Jr.")).toMatchObject({
      overallRank: 81,
      position: "WR",
      positionRank: 40,
      auctionValue: 4,
    });
    expect(espnPpr300AuctionBaselineValueFor("Texans D/ST")).toMatchObject({
      overallRank: 169,
      position: "DST",
      positionRank: 1,
      auctionValue: 0,
    });
    expect(espnPpr300AuctionBaselineValueFor("Vikings D/ST")).toMatchObject({
      overallRank: 300,
      position: "DST",
      positionRank: 22,
      auctionValue: 0,
    });
  });

  it("resolves catalog spelling and suffix variants through canonical player identity", () => {
    expect(espnPpr300AuctionBaselineValueFor("Devon Achane")?.auctionValue).toBe(50);
    expect(espnPpr300AuctionBaselineValueFor("James Cook")?.auctionValue).toBe(46);
    expect(espnPpr300AuctionBaselineValueFor("Brian Thomas")?.auctionValue).toBe(4);
    expect(espnPpr300AuctionBaselineValueFor("Not A Player")).toBeUndefined();
  });
});
