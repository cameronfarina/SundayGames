import type { MockBatchSummary, MockRun } from "./contracts.js";
import { summarizeOwnerPlayerExposure } from "./exposureSummary.js";
import { summarizeOwners } from "./ownerSummary.js";
import { summarizePlayers } from "./playerSummary.js";
import { summarizeScenarios } from "./scenarioSummary.js";

export const summarizeMockBatch = (runs: readonly MockRun[]): MockBatchSummary => ({
  runCount: runs.length,
  scenarios: summarizeScenarios(runs),
  players: summarizePlayers(runs),
  owners: summarizeOwners(runs),
  ownerPlayerExposure: summarizeOwnerPlayerExposure(runs),
});
