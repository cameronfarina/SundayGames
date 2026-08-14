import { describe, expect, it } from "vitest";
import { ownerOrder, type Owner, type Position } from "../config/league.js";
import { buildMockResultsReport } from "../src/modeling/mockResults.js";
import type { MockBatch, MockRosterSummary } from "../src/modeling/mockBatch.js";
import type { Player } from "../src/types.js";

const player = (
  owner: Owner,
  label: string,
  position: Position,
  price: number,
  week1: number,
  weeks1To4: number,
  seasonProjection = weeks1To4 * 4,
): Player => ({
  name: `${owner} ${label}`,
  position,
  price,
  week1,
  weeks1To4,
  seasonProjection,
});

const rosterPlayers = (
  owner: Owner,
  weekOneBoost = 0,
  seasonBoost = 0,
  benchBoost = 0,
): Player[] => [
  player(owner, "QB", "QB", 2, 18 + weekOneBoost, 72 + seasonBoost),
  player(owner, "RB1", "RB", 46, 20 + weekOneBoost, 80 + seasonBoost),
  player(owner, "RB2", "RB", 34, 17 + weekOneBoost, 68 + seasonBoost),
  player(owner, "WR1", "WR", 42, 19 + weekOneBoost, 76 + seasonBoost),
  player(owner, "WR2", "WR", 28, 15 + weekOneBoost, 60 + seasonBoost),
  player(owner, "TE", "TE", 6, 10 + weekOneBoost, 40 + seasonBoost),
  player(owner, "FLEX", "RB", 18, 13 + weekOneBoost, 52 + seasonBoost),
  player(owner, "K", "K", 1, 8 + weekOneBoost, 32 + seasonBoost),
  player(owner, "DST", "DST", 1, 7 + weekOneBoost, 28 + seasonBoost),
  player(owner, "Bench RB 1", "RB", 8, 7, 28 + benchBoost),
  player(owner, "Bench WR 1", "WR", 7, 6, 24 + benchBoost),
  player(owner, "Bench RB 2", "RB", 5, 5, 20 + benchBoost),
  player(owner, "Bench WR 2", "WR", 4, 4, 16 + benchBoost),
  player(owner, "Bench QB", "QB", 1, 3, 12),
  player(owner, "Bench TE", "TE", 1, 2, 8),
  player(owner, "Bench K", "K", 1, 1, 4),
];

const rosterSummary = (
  owner: Owner,
  weekOneBoost = 0,
  seasonBoost = 0,
  benchBoost = 0,
): MockRosterSummary => {
  const players = rosterPlayers(owner, weekOneBoost, seasonBoost, benchBoost);
  const spend = players.reduce((total, current) => total + current.price, 0);

  return {
    owner,
    spend,
    budgetRemaining: 200 - spend,
    week1Score: players.slice(0, 9).reduce((total, current) => total + current.week1, 0),
    weeks1To4Score: players.slice(0, 9).reduce((total, current) => total + current.weeks1To4, 0),
    valid: true,
    errors: [],
    players,
    positionSpend: { QB: 3, RB: 111, WR: 81, TE: 7, K: 2, DST: 1 },
  };
};

const mockRun = (
  rosters: MockRosterSummary[],
  index = 0,
): MockBatch["runs"][number] => ({
  seed: `mock-results-test:${index + 1}`,
  keeperScenario: {
    key: "expected",
    label: "Expected",
    includedKeeperStatuses: ["confirmed", "assumed"],
    keeperCounts: { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
    totalKeeperCost: 0,
    openAuctionDollars: 2800,
    globalFactor: 1,
    positionFactors: { QB: 1, RB: 1, WR: 1, TE: 1, K: 1, DST: 1 },
  },
  inputCounts: {
    pricedPlayers: 500,
    auctionPlayers: 218,
    lockedKeepers: 0,
  },
  pickCount: 218,
  picks: [],
  budgetTrajectory: [],
  rosters,
  invalidRosterCount: 0,
  unsoldPlayerCount: 0,
});

const mockBatch = (
  rosters: MockRosterSummary[] | MockRosterSummary[][],
  runsPerScenario = 1,
): MockBatch => ({
  options: {
    scenarioKeys: ["expected"],
    runsPerScenario,
    seedPrefix: "mock-results-test",
  },
  runs: (Array.isArray(rosters[0]) ? rosters as MockRosterSummary[][] : [rosters as MockRosterSummary[]])
    .map((runRosters, index) => mockRun(runRosters, index)),
  summary: {
    runCount: Array.isArray(rosters[0]) ? (rosters as MockRosterSummary[][]).length : 1,
    scenarios: [{
      key: "expected",
      label: "Expected",
      runCount: Array.isArray(rosters[0]) ? (rosters as MockRosterSummary[][]).length : 1,
      invalidRosterCount: 0,
      averagePickCount: 218,
    }],
    players: [],
    owners: [],
    ownerPlayerExposure: [],
  },
});

describe("mock results report", () => {
  it("separates Week 1 scoring from season-strength projected finish", () => {
    const rosters = ownerOrder.map(owner => {
      if (owner === "Owner13") return rosterSummary(owner, 4, -3, 0);
      if (owner === "Owner11") return rosterSummary(owner, 0, 4, 8);
      return rosterSummary(owner);
    });

    const report = buildMockResultsReport(mockBatch(rosters), "three-rb");
    const run = report.runs[0];
    expect(run).toBeDefined();
    if (!run) throw new Error("Expected one mock results run");

    expect(run.rankings[0]).toMatchObject({
      owner: "Owner11",
      rank: 1,
      week1Rank: expect.any(Number),
      seasonStrengthScore: expect.any(Number),
      projectedFinishScore: expect.any(Number),
    });
    expect(run.rankings.find(ranking => ranking.owner === "Owner13")?.week1Rank).toBe(1);
    expect(run.rankings[0]?.explanation).toContain("season strength");
    expect(run.bestBuild.owner).toBe("Owner11");
    expect(run.bestBuild.headline).toContain("season-strength score");
    expect(run.teams.find(team => team.owner === "Owner11")).toMatchObject({
      projectedRank: 1,
      seasonStrengthScore: run.rankings[0]?.seasonStrengthScore,
      depthScore: expect.any(Number),
      consistencyScore: expect.any(Number),
    });
  });

  it("builds the user outcome for the requested watch owner", () => {
    const rosters = ownerOrder.map(owner => rosterSummary(owner));
    const report = buildMockResultsReport(mockBatch(rosters), "three-rb", [], undefined, [], "Owner02");

    expect(report.watchOwner).toBe("Owner02");
    expect(report.runs[0]?.camOutcome.owner).toBe("Owner02");
  });

  it("uses full-season projection for projected finish when it differs from Weeks 1-4", () => {
    const rosters = ownerOrder.map(owner => {
      const summary = owner === "Owner13"
        ? rosterSummary(owner, 0, 30, 0)
        : rosterSummary(owner, 0, owner === "Owner11" ? -10 : 0, 0);

      if (owner === "Owner13") {
        return {
          ...summary,
          players: summary.players.map(current => ({
            ...current,
            seasonProjection: current.weeks1To4 * 2,
          })),
        };
      }

      if (owner === "Owner11") {
        return {
          ...summary,
          players: summary.players.map(current => ({
            ...current,
            seasonProjection: current.weeks1To4 * 7,
          })),
        };
      }

      return summary;
    });

    const report = buildMockResultsReport(mockBatch(rosters), "three-rb");
    const run = report.runs[0];
    expect(run).toBeDefined();
    if (!run) throw new Error("Expected one mock results run");

    const owner11 = run.teams.find(team => team.owner === "Owner11");
    const martins = run.teams.find(team => team.owner === "Owner13");

    expect(owner11).toBeDefined();
    expect(martins).toBeDefined();
    expect(martins?.weeks1To4Score).toBeGreaterThan(owner11?.weeks1To4Score ?? 0);
    expect(owner11?.starterSeasonScore).toBeGreaterThan(martins?.starterSeasonScore ?? 0);
    expect(run.rankings[0]?.owner).toBe("Owner11");
  });

  it("summarizes scripted target outcomes across mock results", () => {
    const rosters = ownerOrder.map(owner => {
      const summary = rosterSummary(owner);
      if (owner !== "Owner11") return summary;

      return {
        ...summary,
        players: [
          {
            ...player("Owner11", "Target RB", "RB", 20, 11, 44),
            name: "Jadarian Price",
          },
          ...summary.players.slice(1),
        ],
      };
    });
    const report = buildMockResultsReport(mockBatch(rosters), "three-rb", [], {
      raw: "target Jadarian Price max 20",
      label: "Target Jadarian Price up to $20",
      targetMaxBids: [{ owner: "Owner11", player: "Jadarian Price", maxBid: 20 }],
    });

    expect(report.script).toMatchObject({
      raw: "target Jadarian Price max 20",
      label: "Target Jadarian Price up to $20",
      targetOutcomes: [
        {
          owner: "Owner11",
          player: "Jadarian Price",
          maxBid: 20,
          runCount: 1,
          draftedByOwnerCount: 1,
          draftedByOwnerRate: 1,
          draftedByOtherCount: 0,
          undraftedCount: 0,
          averageSalePrice: 20,
        },
      ],
    });
  });

  it("summarizes build-around outcomes by forced price point", () => {
    const runRosters = [46, 46, 50, 50].map((price, index) =>
      ownerOrder.map(owner => {
        const summary = owner === "Owner11"
          ? rosterSummary(
            owner,
            index === 0 ? 3 : index === 1 ? 2 : index === 2 ? 0 : -1,
            index === 0 ? 12 : index === 1 ? 10 : index === 2 ? 4 : 2,
            index === 0 ? 6 : index === 1 ? 4 : index === 2 ? 1 : 0,
          )
          : rosterSummary(owner, owner === "Owner13" ? 1 : 0, owner === "Owner13" ? 5 : 0);
        if (owner !== "Owner11") return summary;

        return {
          ...summary,
          spend: summary.spend + price - 46,
          budgetRemaining: summary.budgetRemaining - price + 46,
          players: [
            {
              ...player("Owner11", "Build RB", "RB", price, 18, 72),
              name: "Omarion Hampton",
            },
            ...summary.players.slice(1),
          ],
        };
      }));

    const report = buildMockResultsReport(mockBatch(runRosters, 2), "three-rb", [], {
      raw: "Build around Omarion Hampton:46-50:4",
      label: "Build around Omarion Hampton at $46/$50",
      buildAround: { owner: "Owner11", player: "Omarion Hampton", prices: [46, 50] },
      targetMaxBids: [],
    });

    expect(report.script?.buildAroundOutcomes).toEqual([
      expect.objectContaining({
        owner: "Owner11",
        player: "Omarion Hampton",
        price: 46,
        runCount: 2,
        draftedByOwnerCount: 2,
        averageSalePrice: 46,
        minimumSalePrice: 46,
        maximumSalePrice: 46,
        averageCamWeek1Score: expect.any(Number),
        averageCamSeasonStrengthScore: expect.any(Number),
        bestRunLabel: "Run 1: 3rb",
        worstRunLabel: "Run 2: 3rb",
      }),
      expect.objectContaining({
        owner: "Owner11",
        player: "Omarion Hampton",
        price: 50,
        runCount: 2,
        draftedByOwnerCount: 2,
        averageSalePrice: 50,
        minimumSalePrice: 50,
        maximumSalePrice: 50,
        bestRunLabel: "Run 3: 3rb",
        worstRunLabel: "Run 4: 3rb",
      }),
    ]);
    const outcomes = report.script?.buildAroundOutcomes ?? [];
    expect(outcomes[0]?.averageCamRank).toBeLessThanOrEqual(outcomes[1]?.averageCamRank ?? 99);
    expect(outcomes[0]?.averageCamSeasonStrengthScore).toBeGreaterThan(outcomes[1]?.averageCamSeasonStrengthScore ?? 0);
  });
});
