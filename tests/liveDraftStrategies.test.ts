import { describe, expect, it } from "vitest";
import {
  parseLiveDraftStrategyKey,
  projectionAdjustedAuctionValue,
  projectionRankAdjustmentFactor,
  projectionScoringMatches,
  strategyAdjustedAuctionValue,
} from "../src/modeling/liveDraftStrategies.js";

describe("live draft strategy parsing", () => {
  it("accepts supported keys and defaults unknown values", () => {
    expect(parseLiveDraftStrategyKey("balanced")).toBe("balanced");
    expect(parseLiveDraftStrategyKey("wr-heavy")).toBe("wr-heavy");
    expect(parseLiveDraftStrategyKey("unknown")).toBe("three-rb");
    expect(parseLiveDraftStrategyKey(undefined)).toBe("three-rb");
  });
});

describe("projection-adjusted auction values", () => {
  it("turns positional projection rank differences into a capped adjustment", () => {
    expect(projectionRankAdjustmentFactor({
      projectionPositionRank: 3,
      publicPositionRank: 5,
    })).toBe(1.02);
    expect(projectionRankAdjustmentFactor({
      projectionPositionRank: 17,
      publicPositionRank: 5,
    })).toBe(0.88);
    expect(projectionRankAdjustmentFactor({
      projectionPositionRank: 1,
      publicPositionRank: 30,
    })).toBe(1.12);
  });

  it("keeps the market baseline when either positional rank is unavailable", () => {
    expect(projectionRankAdjustmentFactor({
      projectionPositionRank: undefined,
      publicPositionRank: 4,
    })).toBe(1);
    expect(projectionRankAdjustmentFactor({
      projectionPositionRank: 4,
      publicPositionRank: undefined,
    })).toBe(1);
  });

  it("adjusts the player's market anchor by its calibrated projection ratio", () => {
    expect(projectionAdjustedAuctionValue({
      marketValue: 60,
      projectionAdjustmentFactor: 0.8,
    })).toBe(48);
    expect(projectionAdjustedAuctionValue({
      marketValue: 48,
      projectionAdjustmentFactor: 1.25,
    })).toBe(60);
  });

  it("keeps market value when the projection ratio is unavailable or invalid", () => {
    expect(projectionAdjustedAuctionValue({ marketValue: 20 })).toBe(20);
    expect(projectionAdjustedAuctionValue({
      marketValue: 20,
      projectionAdjustmentFactor: 0,
    })).toBe(20);
  });

  it("applies strategy premiums after projection adjusts the personal baseline", () => {
    const baseline = projectionAdjustedAuctionValue({
      marketValue: 60,
      projectionAdjustmentFactor: 0.8,
    });

    expect(strategyAdjustedAuctionValue({
      marketValue: baseline,
      position: "RB",
      strategyKey: "balanced",
      positionCount: 1,
      starterCount: 2,
      flexNeedsPlayer: false,
      maximumBid: 136,
    })).toBe(52);
  });

  it("uses calibrated ratios only when the league scoring matches their basis", () => {
    const calibrationScoring = {
      rushingYards: 0.1,
      rushingTouchdown: 6,
      receivingYards: 0.1,
      receivingTouchdown: 6,
      reception: 0.5,
    };

    expect(projectionScoringMatches(calibrationScoring, calibrationScoring)).toBe(true);
    expect(projectionScoringMatches(calibrationScoring, {
      ...calibrationScoring,
      reception: 1,
    })).toBe(false);
    expect(projectionScoringMatches(undefined, calibrationScoring)).toBe(false);
  });
});
