import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import {
  runMock,
  runMockBatch,
  runMockBatchProgressively,
  type RunMockBatchOptions,
  type RunMockBatchProgress,
} from "../src/modeling/mockBatch.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const inputsPromise = Promise.all([
  loadEspnWeeksOneToFour("data/raw/espn-projections-2026-weeks-1-4.json"),
  loadHistoricalAuctionRecords(),
]).then(([projections, historicalRecords]) => ({ projections, historicalRecords }));

describe("mock batch public contract", () => {
  it("keeps singular and one-run batch execution identical for the same seed", async () => {
    const inputs = await inputsPromise;
    const seed = "contract-parity:expected:1";
    const single = runMock({
      ...inputs,
      keepers,
      scenarioKey: "expected",
      seed,
      diagnosticsMode: "summary",
    });
    const batch = runMockBatch({
      ...inputs,
      keepers,
      scenarioKeys: ["expected"],
      runsPerScenario: 1,
      seedPrefix: "contract-parity",
      diagnosticsMode: "summary",
    });
    const batchRun = batch.runs[0];
    if (!batchRun) throw new Error("Expected a batch run.");

    expect(batchRun).toEqual(single);
  });

  it("keeps progressive results and callback ordering identical to synchronous runs", async () => {
    const inputs = await inputsPromise;
    const progress: RunMockBatchProgress[] = [];
    const options: RunMockBatchOptions = {
      ...inputs,
      keepers,
      scenarioKeys: ["expected"],
      runsPerScenario: 2,
      seedPrefix: "progressive-parity",
      diagnosticsMode: "summary",
    };
    const progressive = await runMockBatchProgressively({
      ...options,
      onRunComplete: update => {
        progress.push(update);
      },
    });

    expect(progress.map(update => ({
      seed: update.run.seed,
      completedRuns: update.completedRuns,
      totalRuns: update.totalRuns,
    }))).toEqual([
      { seed: "progressive-parity:expected:1", completedRuns: 1, totalRuns: 2 },
      { seed: "progressive-parity:expected:2", completedRuns: 2, totalRuns: 2 },
    ]);
    expect(progressive).toEqual(runMockBatch(options));
  });

  it("preserves forced-sale validation errors", async () => {
    const inputs = await inputsPromise;
    const baseOptions: RunMockBatchOptions = {
      ...inputs,
      keepers,
      scenarioKeys: ["expected"],
      runsPerScenario: 1,
      diagnosticsMode: "summary",
    };

    expect(() => runMockBatch({
      ...baseOptions,
      forcedSales: [{ owner: "Owner11", player: "Puka Nacua", price: 0 }],
    })).toThrow("Forced sale for Puka Nacua must use a positive whole-dollar price.");
    expect(() => runMockBatch({
      ...baseOptions,
      forcedSales: [
        { owner: "Owner11", player: "Puka Nacua", price: 50 },
        { owner: "Owner12", player: "Puka Nacua", price: 51 },
      ],
    })).toThrow("Forced sale duplicates Puka Nacua.");
    expect(() => runMockBatch({
      ...baseOptions,
      forcedSales: [{ owner: "Owner11", player: "Missing Player", price: 1 }],
    })).toThrow('Forced sale player "Missing Player" is not available in the auction pool.');
  });
});
