import { describe, expect, it } from "vitest";
import { ownerOrder, positions } from "../config/league.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import type { HistoricalAuctionRecord } from "../src/data/parseHistoricalBoards.js";
import {
  buildLeagueOpenAuctionSpendTargets,
  buildOwnerProfiles,
  defaultHistoricalWeights,
} from "../src/modeling/ownerProfiles.js";

const record = (
  season: number,
  position: HistoricalAuctionRecord["position"],
  price: number,
  acquisitionType: HistoricalAuctionRecord["acquisitionType"],
  isKeeper = false,
): HistoricalAuctionRecord => ({
  season,
  owner: "Owner01",
  rosterRow: 1,
  originalPlayerName: `${position} player`,
  normalizedPlayerName: `${position.toLowerCase()} player`,
  position,
  price,
  isKeeper,
  acquisitionType,
  source: "owner-profile-test",
});

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

  it("applies historical weights without renormalizing missing seasons", () => {
    const profiles = buildOwnerProfiles([
      record(2023, "RB", 10, "auction"),
      record(2024, "RB", 20, "auction"),
      record(2025, "RB", 30, "auction"),
    ]);
    const profile = profiles.find(candidate => candidate.owner === "Owner01");
    if (!profile) throw new Error("Owner01 profile was not built.");

    expect(profile.openAuctionSpend.RB).toBe(23);
  });

  it("preserves acquisition-specific profile behavior", () => {
    const records = [
      record(2025, "RB", 50, "auction"),
      record(2025, "WR", 40, "keeper", true),
      record(2025, "RB", 1, "post-draft waiver"),
      record(2025, "K", 3, "auction"),
      record(2025, "DST", 20, "auction"),
      record(2025, "WR", 1, "auction"),
    ];
    const profile = buildOwnerProfiles(records, { 2025: 1 })
      .find(candidate => candidate.owner === "Owner01");
    if (!profile) throw new Error("Owner01 profile was not built.");

    expect(profile.openAuctionSpend).toEqual({ QB: 0, RB: 50, WR: 1, TE: 0 });
    expect(profile.rosterCounts).toEqual({ QB: 0, RB: 2, WR: 2, TE: 0, K: 1, DST: 1 });
    expect(profile.normalSpecialTeamsSpend).toBe(3);
    expect(profile.topTwoConcentration).toBe(78.9);
    expect(profile.oneDollarPlayerCount).toBe(2);
    expect(profile.averageKeeperCost).toBe(40);
    expect(profile.profileLabel).toBe("expensive-keeper dependent");
  });

  it("balances representative special-teams spend across K and DST", () => {
    const targets = buildLeagueOpenAuctionSpendTargets([
      record(2025, "RB", 50, "auction"),
      record(2025, "WR", 1, "auction"),
      record(2025, "K", 3, "auction"),
      record(2025, "DST", 20, "auction"),
      record(2025, "TE", 10, "keeper", true),
    ], { 2025: 1 });

    expect(targets.byPosition).toEqual({ QB: 0, RB: 50, WR: 1, TE: 0, K: 1.5, DST: 1.5 });
    expect(targets.total).toBe(54);
  });
});
