import { expect, it } from "vitest";
import type { AuctionLeagueSeasonSettings, LeagueSeason } from "../../src/platform/leagueSeason.js";
import { runSeasonSimulations } from "../../src/platform/seasonSimulationEngine.js";
import { auctionSetup } from "./draftSetups.js";
import { auctionSeason } from "./leagueFixtures.js";

export const registerEliteAuctionTests = (): void => {
  it("enforces and reports the league-relative auction elite tier", () => {
    const season: LeagueSeason<AuctionLeagueSeasonSettings> = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        auction: { budgetDollars: 100, minimumBidDollars: 1 },
      },
    };
    const result = runSeasonSimulations({
      season,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 2,
      strategyInput: "Target an elite RB to pair with Achane",
      seedPrefix: "auction-elite-tier",
    });

    expect(result.preferenceOutcomes).toEqual([expect.objectContaining({
      position: "RB",
      tier: "elite",
      targetCount: 1,
      status: "hit",
      feasible: true,
      hitCount: 2,
      hitRate: 1,
      rule: {
        basis: "auction_expected_value",
        positionRankMaximum: 1,
        qualifyingPlayerIds: ["elite runner"],
        minimumExpectedValue: 45,
      },
    })]);
    for (const run of result.runs) {
      const roster = run.teams.find(team => team.teamId === "team-1")?.roster ?? [];
      expect(roster).toEqual(expect.arrayContaining([
        expect.objectContaining({ playerName: "Elite Runner", source: "human" }),
      ]));
    }
  });

  it("reports an infeasible elite auction preference instead of treating any RB as elite", () => {
    const result = runSeasonSimulations({
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "Draft 2 elite RBs for no more than $10 each",
      seedPrefix: "infeasible-auction-elite-tier",
    });

    expect(result.preferenceOutcomes).toEqual([expect.objectContaining({
      position: "RB",
      tier: "elite",
      targetCount: 2,
      status: "infeasible",
      feasible: false,
      hitCount: 0,
      hitRate: 0,
    })]);
    expect(result.strategy.warnings).toContain(
      "Elite RB preference is infeasible: the league-relative tier and $10 cap cannot supply 2 players.",
    );
  });

  it("reports a feasible elite preference miss when the market clears above its cap", () => {
    // 150 keeps the 40% single-bid cap ($60) above the elite tier, so the
    // market can still clear elites past this manager's $45 limit.
    const season: LeagueSeason<AuctionLeagueSeasonSettings> = {
      ...auctionSeason,
      settings: {
        ...auctionSeason.settings,
        auction: { budgetDollars: 150, minimumBidDollars: 1 },
      },
    };
    const result = runSeasonSimulations({
      season,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "Target 1 elite RB for no more than $45 to pair with Achane",
      seedPrefix: "missed-auction-elite-tier",
    });

    expect(result.preferenceOutcomes).toEqual([expect.objectContaining({
      position: "RB",
      status: "miss",
      feasible: true,
      hitCount: 0,
      hitRate: 0,
    })]);
  });
};
