import { normalizePlayerName } from "../data/normalizePlayerName.js";
import { strategyAuctionOverridesFor } from "../modeling/interactiveMockDraft.js";
import {
  runMockBatchProgressively,
  summarizeMockBatch,
  type MockBatch,
} from "../modeling/mockBatch.js";
import { buildMockResultsReport } from "../modeling/mockResults.js";
import type { CreateLiveDraftServerOptions, MockBatchJob } from "./contracts.js";
import {
  buildAroundRunLabelsFor,
  forcedSaleForBuildAroundRun,
  mergeAuctionConfigOverrides,
  targetMaxBidOverridesFor,
} from "./mockInput.js";
import type { LiveDraftData } from "./runtimeContracts.js";
import type { BatchJobRegistry } from "./batchJobRegistry.js";

const yieldToEventLoop = async (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

const updateProgress = (job: MockBatchJob, completedRuns: number, now: () => Date): void => {
  job.completedRuns = completedRuns;
  job.percent = job.totalRuns <= 0 ? 100 : Math.round((completedRuns / job.totalRuns) * 100);
  job.updatedAt = now().toISOString();
};

const runBuildAroundSegments = async ({
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
        strategyAuctionOverridesFor(job.watchOwner, job.strategyKey, { variantSeed: `${seedPrefix}:${price}` }),
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

interface RunJobContext {
  job: MockBatchJob;
  runsPerScenario: number;
  seedPrefix: string;
  options: CreateLiveDraftServerOptions;
  data: LiveDraftData;
  now: () => Date;
}

const runBatch = async (context: RunJobContext): Promise<MockBatch> => {
  const { job, runsPerScenario, seedPrefix, options, data, now } = context;
  if (options.mockBatchRunner && job.script?.buildAround) {
    return runBuildAroundSegments(context);
  }
  const scriptOverrides = targetMaxBidOverridesFor(job.script);
  if (options.mockBatchRunner) {
    return options.mockBatchRunner({
      projections: data.projections,
      historicalRecords: data.historicalRecords,
      keepers: data.configuredKeepers,
      scenarioKeys: ["expected"],
      runsPerScenario,
      seedPrefix,
      pricingConfig: data.pricingConfig,
      auctionConfigOverrides: mergeAuctionConfigOverrides(
        strategyAuctionOverridesFor(job.watchOwner, job.strategyKey, { variantSeed: seedPrefix }),
        scriptOverrides,
      ),
      diagnosticsMode: "summary",
    });
  }
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

export const runMockBatchJob = async ({
  registry,
  ...context
}: RunJobContext & { registry: BatchJobRegistry }): Promise<void> => {
  const { job, now } = context;
  job.status = "running";
  job.updatedAt = now().toISOString();
  try {
    const batch = await runBatch(context);
    updateProgress(job, job.totalRuns, now);
    job.status = "complete";
    job.result = buildMockResultsReport(
      batch,
      job.strategyKey,
      job.runStrategyKeys,
      job.script,
      buildAroundRunLabelsFor(job.script, context.runsPerScenario, job.runStrategyKeys),
      job.watchOwner,
    );
    job.updatedAt = now().toISOString();
  } catch (error) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : "Unknown mock batch error.";
    job.updatedAt = now().toISOString();
  } finally {
    registry.prune();
  }
};
