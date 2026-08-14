import type { AuctionDiagnosticsMode } from "../auctionEngine.js";
import type { KeeperScenarioKey } from "../keeperInflation.js";
import type { ForcedAuctionSale, MockBatch, MockRun } from "./contracts.js";
import { summarizeMockBatch } from "./summarizeMockBatch.js";

interface BuildMockBatchOptions {
  scenarioKeys: KeeperScenarioKey[];
  runsPerScenario: number;
  seedPrefix: string;
  diagnosticsMode: AuctionDiagnosticsMode;
  forcedSales: readonly ForcedAuctionSale[];
  runs: MockRun[];
}

export const buildMockBatch = ({
  scenarioKeys,
  runsPerScenario,
  seedPrefix,
  diagnosticsMode,
  forcedSales,
  runs,
}: BuildMockBatchOptions): MockBatch => ({
  options: {
    scenarioKeys,
    runsPerScenario,
    seedPrefix,
    ...(diagnosticsMode === "full" ? {} : { diagnosticsMode }),
    ...(forcedSales.length === 0 ? {} : { forcedSales: [...forcedSales] }),
  },
  runs,
  summary: summarizeMockBatch(runs),
});
