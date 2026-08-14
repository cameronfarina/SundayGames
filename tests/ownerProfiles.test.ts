import { describe, expect, it } from "vitest";
import { ownerOrder, positions } from "../config/league.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import {
  buildLeagueOpenAuctionSpendTargets,
  buildOwnerProfiles,
  defaultHistoricalWeights,
} from "../src/modeling/ownerProfiles.js";

describe("owner profiles", () => {
  it("builds one behavior profile per synthetic owner", async () => {
    const records = await loadHistoricalAuctionRecords();
    const profiles = buildOwnerProfiles(records);

    expect(profiles.map(profile => profile.owner)).toEqual(ownerOrder);
    expect(profiles).toHaveLength(14);
    expect(profiles.every(profile => profile.profileLabel.length > 0)).toBe(true);
    expect(profiles.every(profile =>
      positions.every(position => profile.rosterCounts[position] >= 0),
    )).toBe(true);
  });

  it("builds finite league spend targets from synthetic history", async () => {
    const records = await loadHistoricalAuctionRecords();
    const targets = buildLeagueOpenAuctionSpendTargets(records, defaultHistoricalWeights);
    const positionTotal = positions.reduce(
      (total, position) => total + targets.byPosition[position],
      0,
    );

    expect(targets.total).toBeCloseTo(positionTotal, 1);
    expect(targets.total).toBeGreaterThan(0);
    expect(positions.every(position => Number.isFinite(targets.byPosition[position]))).toBe(true);
  });
});
