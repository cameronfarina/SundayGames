import { normalizePlayerName } from "../data/normalizePlayerName.js";
import { strategyAuctionOverridesFor } from "../modeling/interactiveMockDraft.js";
import { summarizeMockBatch, type MockBatch } from "../modeling/mockBatch.js";
import {
  mergeAuctionConfigOverrides,
  targetMaxBidOverridesFor,
} from "./mockInput.js";
import {
  updateProgress,
  yieldToEventLoop,
  type RunJobContext,
} from "./batchJobRunnerContext.js";

export const runBuildAroundSegments = async ({
  job,
  runsPerScenario,
  seedPrefix,
  options,
  data,
  now,
}: RunJobContext): Promise<MockBatch> => {
  const runner = options.mockBatchRunner;
  const buildAround = job.script?.buildAround;
  if (!runner || !buildAround) throw new Error("Build-around runner is unavailable.");

  const runs: MockBatch["runs"] = [];
  const scriptOverrides = targetMaxBidOverridesFor(job.script);
  for (const price of buildAround.prices) {
    const segment = runner({
      projections: data.projections,
      historicalRecords: data.historicalRecords,
      keepers: data.configuredKeepers,
      scenarioKeys: ["expected"],
      runsPerScenario,
      seedPrefix: `${seedPrefix}:build-around:${normalizePlayerName(buildAround.player)}:${price}`,
      pricingConfig: data.pricingConfig,
      auctionConfigOverrides: mergeAuctionConfigOverrides(
        strategyAuctionOverridesFor(job.watchOwner, job.strategyKey, {
          variantSeed: `${seedPrefix}:${price}`,
        }),
        scriptOverrides,
      ),
      forcedSales: [{ owner: buildAround.owner, player: buildAround.player, price }],
      diagnosticsMode: "summary",
    });
    runs.push(...segment.runs);
    updateProgress(job, Math.min(job.totalRuns, runs.length), now);
    await yieldToEventLoop();
  }

  return {
    options: { scenarioKeys: ["expected"], runsPerScenario, seedPrefix, diagnosticsMode: "summary" },
    runs,
    summary: summarizeMockBatch(runs),
  };
};
