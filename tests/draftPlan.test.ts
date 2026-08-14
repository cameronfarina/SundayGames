import { describe, expect, it } from "vitest";
import { buildDraftPlanReport } from "../src/modeling/draftPlan.js";
import type { MockBatch } from "../src/modeling/mockBatch.js";
import type { Player } from "../src/types.js";

const player = (
  name: string,
  position: Player["position"],
  price: number,
  weeks1To4 = price,
): Player => ({
  name,
  position,
  price,
  week1: weeks1To4 / 4,
  weeks1To4,
});

const emptyPositionAmounts = {
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DST: 0,
};

const expectedScenario = {
  key: "expected",
  label: "Expected",
  includedKeeperStatuses: ["confirmed", "assumed"],
  keeperCounts: emptyPositionAmounts,
  totalKeeperCost: 0,
  openAuctionDollars: 2800,
  globalFactor: 1,
  positionFactors: {
    QB: 1,
    RB: 1,
    WR: 1,
    TE: 1,
    K: 1,
    DST: 1,
  },
} as const;

describe("draft plan generation", () => {
  it("filters real mock rosters into true 3RB draft plans with sale bands", () => {
    const batch: MockBatch = {
      options: {
        scenarioKeys: ["expected"],
        runsPerScenario: 2,
        seedPrefix: "draft-plan-test",
      },
      runs: [
        {
          seed: "draft-plan-test:expected:1",
          keeperScenario: expectedScenario,
          inputCounts: {
            pricedPlayers: 0,
            auctionPlayers: 0,
            lockedKeepers: 0,
          },
          pickCount: 0,
          picks: [],
          budgetTrajectory: [],
          rosters: [
            {
              owner: "Owner11",
              spend: 200,
              budgetRemaining: 0,
              week1Score: 120,
              weeks1To4Score: 480,
              valid: true,
              errors: [],
              positionSpend: {
                QB: 2,
                RB: 156,
                WR: 35,
                TE: 3,
                K: 2,
                DST: 2,
              },
              players: [
                player("Justin Herbert", "QB", 2),
                player("Elite RB", "RB", 62, 80),
                player("Strong RB", "RB", 52, 72),
                player("Flex RB", "RB", 42, 64),
                player("WR Value 1", "WR", 20, 60),
                player("WR Value 2", "WR", 14, 52),
                player("Cheap TE", "TE", 3, 32),
                player("Bench RB", "RB", 1, 20),
                player("Bench WR 1", "WR", 1, 24),
                player("Bench WR 2", "WR", 1, 20),
                player("Bench WR 3", "WR", 1, 16),
                player("Bench WR 4", "WR", 1, 12),
                player("Bench WR 5", "WR", 1, 8),
                player("Bench TE", "TE", 1, 6),
                player("Kicker", "K", 1),
                player("Defense", "DST", 1),
              ],
            },
          ],
          invalidRosterCount: 0,
          unsoldPlayerCount: 0,
        },
        {
          seed: "draft-plan-test:expected:2",
          keeperScenario: expectedScenario,
          inputCounts: {
            pricedPlayers: 0,
            auctionPlayers: 0,
            lockedKeepers: 0,
          },
          pickCount: 0,
          picks: [],
          budgetTrajectory: [],
          rosters: [
            {
              owner: "Owner11",
              spend: 200,
              budgetRemaining: 0,
              week1Score: 110,
              weeks1To4Score: 440,
              valid: true,
              errors: [],
              positionSpend: {
                QB: 2,
                RB: 137,
                WR: 56,
                TE: 3,
                K: 1,
                DST: 1,
              },
              players: [
                player("Justin Herbert", "QB", 2),
                player("Elite RB", "RB", 62, 80),
                player("Strong RB", "RB", 50, 72),
                player("Light RB", "RB", 25, 46),
                player("WR Value 1", "WR", 25, 60),
                player("WR Value 2", "WR", 20, 52),
                player("Cheap TE", "TE", 3, 32),
                player("Kicker", "K", 1),
                player("Defense", "DST", 1),
              ],
            },
          ],
          invalidRosterCount: 0,
          unsoldPlayerCount: 0,
        },
      ],
      summary: {
        runCount: 2,
        scenarios: [],
        players: [
          {
            name: "Elite RB",
            position: "RB",
            draftedCount: 2,
            draftedRate: 1,
            averageMarketPrice: 60,
            averageSalePrice: 62,
            minimumSalePrice: 62,
            maximumSalePrice: 62,
          },
          {
            name: "Flex RB",
            position: "RB",
            draftedCount: 1,
            draftedRate: 0.5,
            averageMarketPrice: 39,
            averageSalePrice: 42,
            minimumSalePrice: 42,
            maximumSalePrice: 42,
          },
          {
            name: "Fallback RB",
            position: "RB",
            draftedCount: 2,
            draftedRate: 1,
            averageMarketPrice: 36,
            averageSalePrice: 34,
            minimumSalePrice: 32,
            maximumSalePrice: 36,
          },
        ],
        owners: [],
        ownerPlayerExposure: [],
      },
    };

    const report = buildDraftPlanReport({
      batch,
      owner: "Owner11",
      strategyKey: "three-rb",
      limit: 5,
    });

    expect(report.runCount).toBe(2);
    expect(report.matchedRunCount).toBe(2);
    expect(report.recommendations.maxPriceBands).toEqual([
      expect.objectContaining({
        slot: "RB1",
        position: "RB",
        minimumPrice: 50,
        maximumPrice: 76,
      }),
      expect.objectContaining({
        slot: "RB2",
        position: "RB",
        minimumPrice: 35,
        maximumPrice: 76,
      }),
      expect.objectContaining({
        slot: "RB3",
        position: "RB",
        minimumPrice: 12,
        maximumPrice: 48,
      }),
      expect.objectContaining({
        slot: "WR1",
        position: "WR",
        minimumPrice: 12,
        maximumPrice: 26,
      }),
      expect.objectContaining({
        slot: "WR2",
        position: "WR",
        minimumPrice: 8,
        maximumPrice: 20,
      }),
      expect.objectContaining({
        slot: "TE",
        position: "TE",
        minimumPrice: 1,
        maximumPrice: 4,
      }),
    ]);
    expect(report.recommendations.targetClusters[0]).toEqual(expect.objectContaining({
      label: "RB core",
      position: "RB",
      targetNames: ["Elite RB", "Strong RB", "Flex RB"],
      priceBand: "$50-$76 / $35-$76 / $12-$48",
    }));
    expect(report.recommendations.pivotRules[0]).toEqual(expect.objectContaining({
      label: "RB budget envelope",
      trigger: "The first two RBs use most of the RB core budget.",
    }));
    expect(report.recommendations.deadZoneWarnings).toEqual([]);
    expect(report.recommendations.strategyCoach).toMatchObject({
      sampleSize: 2,
      headline: expect.stringContaining("Top 2 sampled"),
      blueprint: expect.arrayContaining([
        expect.objectContaining({
          slot: "RB1",
          position: "RB",
          priceBand: "$62-$62",
          targetNames: ["Elite RB"],
        }),
        expect.objectContaining({
          slot: "RB3",
          position: "RB",
          priceBand: "$25-$42",
          targetNames: ["Flex RB", "Light RB"],
          fallbackPriceBand: "$25-$42",
          fallbackNames: ["Fallback RB"],
        }),
        expect.objectContaining({
          slot: "WR1",
          position: "WR",
          priceBand: "$20-$25",
          targetNames: ["WR Value 1"],
        }),
      ]),
      contingencyPlans: expect.arrayContaining([
        expect.objectContaining({
          label: "After elite RB spend",
          action: expect.stringContaining("RB2"),
        }),
        expect.objectContaining({
          label: "After elite RB spend",
          action: expect.stringContaining("Fallback"),
        }),
        expect.objectContaining({
          label: "WR value pocket",
          action: expect.stringContaining("WR1"),
        }),
      ]),
      riskGuardrails: expect.arrayContaining([
        expect.objectContaining({
          label: "RB core spend",
          detail: expect.stringContaining("$137-$156"),
        }),
      ]),
    });
    expect(report.candidates).toHaveLength(2);
    expect(report.candidates[0]).toMatchObject({
      seed: "draft-plan-test:expected:1",
      owner: "Owner11",
      rosterSpend: 200,
      strategy: "three-rb",
      rbCoreSpend: 156,
      rbCore: [
        {
          name: "Elite RB",
          price: 62,
          market: {
            averageSalePrice: 62,
            minimumSalePrice: 62,
            maximumSalePrice: 62,
          },
        },
        {
          name: "Strong RB",
          price: 52,
        },
        {
          name: "Flex RB",
          price: 42,
          market: {
            averageSalePrice: 42,
            draftedRate: 0.5,
          },
        },
      ],
    });
    expect(report.candidates[0]?.lineup.map(entry => entry.slot)).toEqual([
      "QB",
      "RB1",
      "RB2",
      "WR1",
      "WR2",
      "TE",
      "K",
      "DST",
      "FLEX",
    ]);
  });

  it("accepts fluid true 3RB builds when two elite backs change the third-RB budget", () => {
    const batch: MockBatch = {
      options: {
        scenarioKeys: ["expected"],
        runsPerScenario: 1,
        seedPrefix: "draft-plan-fluid-test",
      },
      runs: [
        {
          seed: "draft-plan-fluid-test:expected:1",
          keeperScenario: expectedScenario,
          inputCounts: {
            pricedPlayers: 0,
            auctionPlayers: 0,
            lockedKeepers: 0,
          },
          pickCount: 0,
          picks: [],
          budgetTrajectory: [],
          rosters: [
            {
              owner: "Owner11",
              spend: 200,
              budgetRemaining: 0,
              week1Score: 124,
              weeks1To4Score: 496,
              valid: true,
              errors: [],
              positionSpend: {
                QB: 2,
                RB: 146,
                WR: 47,
                TE: 3,
                K: 1,
                DST: 1,
              },
              players: [
                player("Justin Herbert", "QB", 2),
                player("Elite RB 1", "RB", 65, 84),
                player("Elite RB 2", "RB", 65, 82),
                player("Value RB 3", "RB", 16, 58),
                player("WR Value 1", "WR", 22, 64),
                player("WR Value 2", "WR", 16, 54),
                player("WR Value 3", "WR", 9, 42),
                player("Cheap TE", "TE", 3, 32),
                player("Bench WR", "WR", 1, 18),
                player("Bench RB", "RB", 1, 12),
                player("Bench TE", "TE", 1, 6),
                player("Kicker", "K", 1),
                player("Defense", "DST", 1),
              ],
            },
          ],
          invalidRosterCount: 0,
          unsoldPlayerCount: 0,
        },
      ],
      summary: {
        runCount: 1,
        scenarios: [],
        players: [],
        owners: [],
        ownerPlayerExposure: [],
      },
    };

    const report = buildDraftPlanReport({
      batch,
      owner: "Owner11",
      strategyKey: "three-rb",
      limit: 5,
    });

    expect(report.matchedRunCount).toBe(1);
    expect(report.candidates[0]?.rbCore.map(player => `${player.name} $${player.price}`)).toEqual([
      "Elite RB 1 $65",
      "Elite RB 2 $65",
      "Value RB 3 $16",
    ]);
    expect(report.candidates[0]?.lineup.find(entry => entry.slot === "FLEX")?.player.name).toBe("Value RB 3");
  });

  it("builds balanced plans without forcing the true 3RB shape", () => {
    const batch: MockBatch = {
      options: {
        scenarioKeys: ["expected"],
        runsPerScenario: 1,
        seedPrefix: "draft-plan-balanced-test",
      },
      runs: [
        {
          seed: "draft-plan-balanced-test:expected:1",
          keeperScenario: expectedScenario,
          inputCounts: {
            pricedPlayers: 0,
            auctionPlayers: 0,
            lockedKeepers: 0,
          },
          pickCount: 0,
          picks: [],
          budgetTrajectory: [],
          rosters: [
            {
              owner: "Owner11",
              spend: 200,
              budgetRemaining: 0,
              week1Score: 118,
              weeks1To4Score: 472,
              valid: true,
              errors: [],
              positionSpend: {
                QB: 2,
                RB: 87,
                WR: 104,
                TE: 4,
                K: 1,
                DST: 2,
              },
              players: [
                player("Cheap QB", "QB", 2),
                player("RB Starter", "RB", 45, 72),
                player("RB Value", "RB", 22, 54),
                player("RB Bench", "RB", 8, 28),
                player("WR Anchor", "WR", 48, 76),
                player("WR Starter", "WR", 34, 64),
                player("WR Flex", "WR", 18, 58),
                player("WR Bench", "WR", 4, 20),
                player("TE Value", "TE", 4, 32),
                player("Kicker", "K", 1),
                player("Defense", "DST", 2),
                player("Bench RB 2", "RB", 1, 12),
                player("Bench WR 2", "WR", 1, 10),
                player("Bench WR 3", "WR", 1, 8),
                player("Bench TE", "TE", 1, 6),
                player("Bench RB 3", "RB", 1, 4),
              ],
            },
          ],
          invalidRosterCount: 0,
          unsoldPlayerCount: 0,
        },
      ],
      summary: {
        runCount: 1,
        scenarios: [],
        players: [],
        owners: [],
        ownerPlayerExposure: [],
      },
    };

    const threeRbReport = buildDraftPlanReport({
      batch,
      owner: "Owner11",
      strategyKey: "three-rb",
      limit: 5,
    });
    const balancedReport = buildDraftPlanReport({
      batch,
      owner: "Owner11",
      strategyKey: "balanced",
      limit: 5,
    });

    expect(threeRbReport.matchedRunCount).toBe(0);
    expect(balancedReport.matchedRunCount).toBe(1);
    expect(balancedReport.strategy.label).toBe("Balanced");
    expect(balancedReport.recommendations.targetClusters[0]).toMatchObject({
      label: "RB starters",
      position: "RB",
      targetNames: ["RB Starter", "RB Value"],
    });
    expect(balancedReport.recommendations.pivotRules.map(rule => rule.label)).toContain("Take the discount");
    expect(balancedReport.recommendations.deadZoneWarnings).toEqual([]);
  });
});
