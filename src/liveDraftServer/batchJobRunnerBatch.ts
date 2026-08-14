import { strategyAuctionOverridesFor } from "../modeling/interactiveMockDraft.js";
import type { MockBatch } from "../modeling/mockBatch.js";
import { runBuildAroundSegments } from "./batchJobRunnerBuildAround.js";
import type { RunJobContext } from "./batchJobRunnerContext.js";
import { runProgressiveBatch } from "./batchJobRunnerProgressive.js";
import {
  mergeAuctionConfigOverrides,
  targetMaxBidOverridesFor,
} from "./mockInput.js";

export const runBatch = async (context: RunJobContext): Promise<MockBatch> => {
  const { job, runsPerScenario, seedPrefix, options, data } = context;
  const runner = options.mockBatchRunner;
  if (runner && job.script?.buildAround) {
    return runBuildAroundSegments(context);
  }
  if (!runner) return runProgressiveBatch(context);

  return runner({
    projections: data.projections,
    historicalRecords: data.historicalRecords,
    keepers: data.configuredKeepers,
    scenarioKeys: ["expected"],
    runsPerScenario,
    seedPrefix,
    pricingConfig: data.pricingConfig,
    auctionConfigOverrides: mergeAuctionConfigOverrides(
      strategyAuctionOverridesFor(job.watchOwner, job.strategyKey, { variantSeed: seedPrefix }),
      targetMaxBidOverridesFor(job.script),
    ),
    diagnosticsMode: "summary",
  });
};
