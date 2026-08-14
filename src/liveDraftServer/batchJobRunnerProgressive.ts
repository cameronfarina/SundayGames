import { strategyAuctionOverridesFor } from "../modeling/interactiveMockDraft.js";
import { runMockBatchProgressively, type MockBatch } from "../modeling/mockBatch.js";
import {
  forcedSaleForBuildAroundRun,
  mergeAuctionConfigOverrides,
  targetMaxBidOverridesFor,
} from "./mockInput.js";
import {
  updateProgress,
  yieldToEventLoop,
  type RunJobContext,
} from "./batchJobRunnerContext.js";

export const runProgressiveBatch = async ({
  job,
  runsPerScenario,
  seedPrefix,
  data,
  now,
}: RunJobContext): Promise<MockBatch> => {
  const scriptOverrides = targetMaxBidOverridesFor(job.script);
  const batch = await runMockBatchProgressively({
    projections: data.projections,
    historicalRecords: data.historicalRecords,
    keepers: data.configuredKeepers,
    scenarioKeys: ["expected"],
    runsPerScenario: job.totalRuns,
    seedPrefix,
    pricingConfig: data.pricingConfig,
    auctionConfigOverridesForRun: progress => mergeAuctionConfigOverrides(
      strategyAuctionOverridesFor(
        job.watchOwner,
        job.runStrategyKeys[progress.completedRuns] ?? job.strategyKey,
        { variantSeed: progress.seed },
      ),
      scriptOverrides,
    ),
    ...(job.script?.buildAround === undefined ? {} : {
      forcedSalesForRun: progress =>
        forcedSaleForBuildAroundRun(job.script, progress.completedRuns, runsPerScenario) ?? [],
    }),
    diagnosticsMode: "summary",
    onRunComplete: async progress => {
      updateProgress(job, progress.completedRuns, now);
      await yieldToEventLoop();
    },
  });

  return job.script?.buildAround
    ? { ...batch, options: { ...batch.options, runsPerScenario } }
    : batch;
};
