import { describe, expect, it } from "vitest";
import {
  byeLabel,
  momentumLabel,
  lineupBasisLabel,
  missingValue,
  ownedLabel,
  pointsLabel,
  positionRankLabel,
  rankLabel,
  spreadLabel,
  tierLabel,
  waiverSourceLabel,
} from "./inSeasonFormat";

describe("in-season labels", () => {
  it("names a rank and admits when there is none", () => {
    expect(rankLabel({ rankEcr: 12 })).toBe("#12");
    expect(rankLabel(undefined)).toBe("Not ranked");
  });

  it("passes through the position rank and the tier", () => {
    expect(positionRankLabel({ rankEcr: 12, positionRank: "RB4" })).toBe("RB4");
    expect(positionRankLabel({ rankEcr: 12 })).toBe(missingValue);
    expect(tierLabel({ rankEcr: 12, tier: 2 })).toBe("Tier 2");
    expect(tierLabel({ rankEcr: 12 })).toBe(missingValue);
    expect(tierLabel(undefined)).toBe(missingValue);
  });

  it("shows the expert range with and without a deviation", () => {
    expect(spreadLabel({ rankEcr: 2, rankMin: 1, rankMax: 4, rankStandardDeviation: 0.88 }))
      .toBe("1–4 (±0.9)");
    expect(spreadLabel({ rankEcr: 2, rankMin: 1, rankMax: 4 })).toBe("1–4");
    expect(spreadLabel({ rankEcr: 2, rankMin: 1 })).toBe(missingValue);
    expect(spreadLabel({ rankEcr: 2, rankMax: 4 })).toBe(missingValue);
    expect(spreadLabel(undefined)).toBe(missingValue);
  });

  it("reads a positive ECR delta as rising and a negative one as falling", () => {
    expect(momentumLabel({ rankEcr: 5, ecrDelta: 3 })).toBe("+3 rising");
    expect(momentumLabel({ rankEcr: 5, ecrDelta: 1 })).toBe("+1 rising");
    expect(momentumLabel({ rankEcr: 5, ecrDelta: -2 })).toBe("-2 falling");
    expect(momentumLabel({ rankEcr: 5, ecrDelta: 0 })).toBe(missingValue);
    expect(momentumLabel({ rankEcr: 5 })).toBe(missingValue);
    expect(momentumLabel(undefined)).toBe(missingValue);
  });

  it("keeps a missing projection, bye, and ownership share visibly empty", () => {
    expect(pointsLabel(16.25)).toBe("16.3");
    expect(pointsLabel(undefined)).toBe(missingValue);
    expect(byeLabel(6)).toBe("Week 6");
    expect(byeLabel(undefined)).toBe(missingValue);
    expect(ownedLabel(41.3)).toBe("41%");
    expect(ownedLabel(undefined)).toBe(missingValue);
  });

  it("names which projection ordered the lineup and which list is on screen", () => {
    expect(lineupBasisLabel("weekly_projection"))
      .toBe("Ordered by this week's FantasyPros projection");
    expect(lineupBasisLabel("rest_of_season_projection"))
      .toBe("Ordered by rest-of-season FantasyPros projection");
    expect(waiverSourceLabel("waiver_rankings")).toBe("FantasyPros waiver rankings");
    expect(waiverSourceLabel("widely_available")).toBe("Widely available players");
  });
});
