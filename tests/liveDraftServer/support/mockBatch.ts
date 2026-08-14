import { ownerOrder } from "../../../config/league.js";
import type { CreateLiveDraftServerOptions } from "../../../src/liveDraftServer.js";
import type { MockBatch } from "../../../src/modeling/mockBatch.js";

export const testPlayer = (
  name: string,
  position: "QB" | "RB" | "WR" | "TE" | "K" | "DST",
  price: number,
  week1: number,
) => ({
  name,
  position,
  price,
  week1,
  weeks1To4: week1 * 4,
});

const testRosterPlayers = (owner: string) => [
  testPlayer(`${owner} QB`, "QB", 2, 18),
  testPlayer(`${owner} RB starter low`, "RB", 45, 6),
  testPlayer(`${owner} RB starter high`, "RB", 60, 22),
  testPlayer(`${owner} RB flex`, "RB", 25, 14),
  testPlayer(`${owner} RB bench`, "RB", 4, 4),
  testPlayer(`${owner} WR starter high`, "WR", 28, 20),
  testPlayer(`${owner} WR starter low`, "WR", 14, 15),
  testPlayer(`${owner} WR bench`, "WR", 3, 5),
  testPlayer(`${owner} TE`, "TE", 8, 10),
  testPlayer(`${owner} TE bench`, "TE", 1, 2),
  testPlayer(`${owner} K`, "K", 1, 8),
  testPlayer(`${owner} DST`, "DST", 1, 7),
  testPlayer(`${owner} Bench WR 1`, "WR", 1, 3),
  testPlayer(`${owner} Bench WR 2`, "WR", 1, 2),
  testPlayer(`${owner} Bench RB 1`, "RB", 1, 1),
  testPlayer(`${owner} Bench RB 2`, "RB", 1, 0.5),
];

export const mockBatchRunner: NonNullable<CreateLiveDraftServerOptions["mockBatchRunner"]> = options => {
  const runCount = options.runsPerScenario ?? 1;
  const runs: MockBatch["runs"] = Array.from({ length: runCount }, (_, index) => {
    const rosters = ownerOrder.map((owner, ownerIndex) => {
      const players = testRosterPlayers(owner);
      const spend = players.reduce((total, player) => total + player.price, 0);
      const week1Score = 104 + ownerIndex + index;
      return {
        owner,
        spend,
        budgetRemaining: 200 - spend,
        week1Score,
        weeks1To4Score: week1Score * 4,
        valid: true,
        errors: [],
        players,
        positionSpend: { QB: 2, RB: 136, WR: 47, TE: 9, K: 1, DST: 1 },
      };
    });

    return {
      seed: `test-seed-${index + 1}`,
      keeperScenario: {
        key: "expected",
        label: "Expected",
        includedKeeperStatuses: ["confirmed", "assumed"],
        keeperCounts: { QB: 1, RB: 6, WR: 6, TE: 1, K: 0, DST: 0 },
        totalKeeperCost: 100,
        openAuctionDollars: 2700,
        globalFactor: 1.04,
        positionFactors: { QB: 1, RB: 1.04, WR: 1.03, TE: 1.02, K: 1, DST: 1 },
      },
      inputCounts: {
        pricedPlayers: 500,
        auctionPlayers: 220,
        lockedKeepers: 6,
      },
      pickCount: 218,
      picks: [],
      budgetTrajectory: [],
      rosters,
      invalidRosterCount: 0,
      unsoldPlayerCount: 0,
    };
  });

  return {
    options: {
      scenarioKeys: [...(options.scenarioKeys ?? ["expected"])],
      runsPerScenario: runCount,
      seedPrefix: options.seedPrefix ?? "test",
      ...(options.diagnosticsMode === undefined ? {} : { diagnosticsMode: options.diagnosticsMode }),
    },
    runs,
    summary: {
      runCount,
      scenarios: [{
        key: "expected",
        label: "Expected",
        runCount,
        invalidRosterCount: 0,
        averagePickCount: 218,
      }],
      players: [{
        name: "Jahmyr Gibbs",
        position: "RB",
        draftedCount: runCount,
        draftedRate: 1,
        averageMarketPrice: 72,
        averageSalePrice: 77,
        minimumSalePrice: 76,
        maximumSalePrice: 78,
      }, {
        name: "Owner11 RB starter high",
        position: "RB",
        draftedCount: runCount,
        draftedRate: 1,
        averageMarketPrice: 58,
        averageSalePrice: 60,
        minimumSalePrice: 60,
        maximumSalePrice: 60,
      }, {
        name: "Owner11 RB flex",
        position: "RB",
        draftedCount: runCount,
        draftedRate: 1,
        averageMarketPrice: 23,
        averageSalePrice: 25,
        minimumSalePrice: 25,
        maximumSalePrice: 25,
      }],
      owners: [{
        owner: "Owner11",
        runCount,
        invalidRosterCount: 0,
        averageSpend: 199,
        minimumSpend: 198,
        maximumSpend: 200,
        averageWeek1Score: 104,
        averageWeeks1To4Score: 410,
        averageBudgetRemaining: 1,
        averagePositionSpend: { QB: 2, RB: 150, WR: 40, TE: 5, K: 1, DST: 1 },
      }],
      ownerPlayerExposure: [{
        owner: "Owner11",
        player: "Jahmyr Gibbs",
        position: "RB",
        draftedCount: runCount,
        draftedRate: 1,
        averagePrice: 77,
      }],
    },
  };
};
