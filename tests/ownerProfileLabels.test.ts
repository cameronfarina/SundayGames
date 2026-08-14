import { describe, expect, it } from "vitest";
import type { OwnerProfileData, ProfilePositionSpend } from "../src/modeling/ownerProfiles/contracts.js";
import { describeProfile } from "../src/modeling/ownerProfiles/describeProfile.js";

const spend = (QB = 0, RB = 0, WR = 0, TE = 0): ProfilePositionSpend => ({
  QB,
  RB,
  WR,
  TE,
});

const profile = (
  openAuctionSpend: ProfilePositionSpend,
  topTwoConcentration = 0,
  averageKeeperCost = 0,
): OwnerProfileData => ({
  owner: "Owner01",
  openAuctionSpend,
  rosterCounts: { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
  normalSpecialTeamsSpend: 0,
  topTwoConcentration,
  oneDollarPlayerCount: 0,
  averageKeeperCost,
});

describe("owner profile labels", () => {
  it.each([
    [profile(spend(), 0, 40), "expensive-keeper dependent"],
    [profile(spend(4, 0, 100)), "extreme wait-on-QB, WR-heavy"],
    [profile(spend(28, 0, 0, 28)), "balanced premium QB/TE"],
    [profile(spend(10, 0, 135), 60), "extreme WR stars and scrubs"],
    [profile(spend(10, 45, 120)), "extreme WR concentration"],
    [profile(spend(10, 50, 120), 58), "WR stars and scrubs"],
    [profile(spend(0, 115), 58), "RB stars and scrubs"],
    [profile(spend(0, 105), 50), "concentrated RB-heavy"],
    [profile(spend(0, 100)), "deep RB-heavy"],
    [profile(spend(20, 90)), "RB concentration plus paid QB"],
    [profile(spend(18, 80, 0, 24)), "RB plus premium TE/QB"],
    [profile(spend(10, 0, 85, 18)), "flexible WR-leaning hybrid"],
    [profile(spend(9, 0, 85)), "low-QB, slight WR lean"],
    [profile(spend(10, 0, 85)), "balanced with WR preference"],
    [profile(spend()), "balanced"],
  ])("describes matching spend behavior", (input, expected) => {
    expect(describeProfile(input)).toBe(expected);
  });
});
