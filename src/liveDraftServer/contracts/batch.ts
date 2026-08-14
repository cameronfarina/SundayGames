import type { Owner } from "../../../config/league.js";
import type { RawPlayerNewsItem } from "../../data/playerNewsProviderAdapters.js";
import type { LiveDraftStrategyKey } from "../../modeling/liveDraftStrategies.js";
import type { MockBatch, RunMockBatchOptions } from "../../modeling/mockBatch.js";
import type { MockResultsReport } from "../../modeling/mockResults.js";
import type { MockDraftScript } from "../../modeling/mockScript.js";
import type { LiveDraftSessionMode } from "./session.js";

export type MockBatchRunner = (options: RunMockBatchOptions) => MockBatch;
export type PlayerNewsProvider = () => Promise<readonly RawPlayerNewsItem[]>;

export interface MockBatchJob {
  jobId: string;
  status: "queued" | "running" | "complete" | "failed";
  source?: "batch" | "interactive-complete";
  draftSessionKey: string;
  watchOwner: Owner;
  draftMode?: LiveDraftSessionMode;
  commandCount?: number;
  strategyKey: LiveDraftStrategyKey;
  runStrategyKeys: readonly LiveDraftStrategyKey[];
  script?: MockDraftScript;
  runsPerScenario: number;
  totalRuns: number;
  completedRuns: number;
  percent: number;
  startedAt: string;
  updatedAt: string;
  result?: MockResultsReport;
  error?: string;
}
