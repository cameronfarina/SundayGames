import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import { buildPlayerPriceAudit } from "../src/modeling/playerPriceAudit.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const inputsPromise = Promise.all([
  loadEspnWeeksOneToFour("data/raw/espn-projections-2026-weeks-1-4.json"),
  loadHistoricalAuctionRecords(),
]).then(([projections, historicalRecords]) => ({ projections, historicalRecords }));

describe("player price audit characterization", () => {
  it("preserves deterministic report and pick ordering", async () => {
    const inputs = await inputsPromise;
    const audit = buildPlayerPriceAudit({
      ...inputs,
      keepers,
      playerName: "Drake London",
      scenarioKey: "expected",
      runs: 2,
      seedPrefix: "audit-order",
    });

    expect(audit.mockSale.picks).toEqual([
      {
        seed: "audit-order:expected:1",
        pick: 12,
        nominator: "Owner07",
        owner: "Owner12",
        salePrice: 59,
        marketPrice: 52,
        budgetAfterPick: 72,
        rosterSlotsAfterPick: 14,
      },
      {
        seed: "audit-order:expected:2",
        pick: 14,
        nominator: "Owner07",
        owner: "Owner09",
        salePrice: 59,
        marketPrice: 52,
        budgetAfterPick: 62,
        rosterSlotsAfterPick: 13,
      },
    ]);
    expect(audit.waterfall.steps.map(step => step.key)).toEqual([
      "espn-anchor",
      "position-multiplier",
      "rank-gap-adjustment",
      "market-pressure",
      "projection-floor",
      "sustainability",
      "factual-context",
      "spend-reconciliation",
      "keeper-inflation",
      "mock-sale-average",
    ]);
    expect(audit.explanation).toEqual([
      "ESPN anchor $45 becomes a $51 base price after rank gap, league multipliers, context, and spend reconciliation.",
      "Expected keeper inflation applies a 1.01x WR factor, moving the auction-pool anchor to $52.",
      "Across 2 mock run(s), the player was drafted 2 time(s) at an average mock sale price of $59.",
    ]);
  });

  it("preserves the unknown-player error contract", async () => {
    const inputs = await inputsPromise;

    expect(() => buildPlayerPriceAudit({
      ...inputs,
      keepers,
      playerName: "Missing Player",
      runs: 0,
    })).toThrow('Unable to find priced player "Missing Player".');
  });

  it("preserves keeper-removal ordering and explanation", async () => {
    const inputs = await inputsPromise;
    const audit = buildPlayerPriceAudit({
      ...inputs,
      keepers,
      playerName: "Justin Jefferson",
      scenarioKey: "expected",
      runs: 1,
      seedPrefix: "audit-removal",
    });

    expect(audit.scenario).toMatchObject({
      available: false,
      scenarioPrice: 0,
      unavailableReason: "Owner04 assumed keeper at $42",
    });
    expect(audit.mockSale).toMatchObject({
      draftedCount: 0,
      averageSalePrice: null,
      averageSaleVsScenarioPrice: null,
    });
    expect(audit.waterfall.steps.slice(-1)).toEqual([
      expect.objectContaining({
        key: "keeper-removal",
        outputAmount: null,
        delta: null,
      }),
    ]);
    expect(audit.explanation.slice(-2)).toEqual([
      "Expected scenario has this player removed from the auction pool: Owner04 assumed keeper at $42",
      "Across 1 mock run(s), the player was not available for a mock sale.",
    ]);
  });

  it("keeps the public entry point as a compatibility facade", async () => {
    const source = await readFile("src/modeling/playerPriceAudit.ts", "utf8");

    expect(source.split("\n").length).toBeLessThanOrEqual(40);
  });
});
