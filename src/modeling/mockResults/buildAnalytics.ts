import type { Owner } from "../../../config/league.js";
import type { MockBatch } from "../mockBatch.js";
import type { DraftPlanStrategyKey } from "../draftPlan.js";
import { buildDraftPlanReport } from "../draftPlan.js";
import type { LiveDraftStrategyKey } from "../liveDraftStrategies.js";
import type { MockResultsAnalytics } from "./analyticsContracts.js";
import type { MockResultsRun } from "./reportContracts.js";
import { topCamRosterPathsFor } from "./rosterPaths.js";
import { camScoreRangeFor } from "./scoreRange.js";
import { strategyLeaderboardFor } from "./strategyAnalytics.js";

const isDraftPlanStrategyKey = (
  strategyKey: LiveDraftStrategyKey,
): strategyKey is DraftPlanStrategyKey => strategyKey === "three-rb";

export const analyticsFor = (
  runs: readonly MockResultsRun[],
  batch: MockBatch,
  strategyKey: LiveDraftStrategyKey,
  watchOwner: Owner,
): MockResultsAnalytics => {
  const strategyCoach = isDraftPlanStrategyKey(strategyKey)
    ? buildDraftPlanReport({ batch, owner: watchOwner, strategyKey, limit: 5 })
      .recommendations.strategyCoach
    : undefined;

  return {
    strategyLeaderboard: strategyLeaderboardFor(runs),
    camScoreRange: camScoreRangeFor(runs),
    topCamRosterPaths: topCamRosterPathsFor(runs),
    ...(strategyCoach === undefined ? {} : { strategyCoach }),
  };
};
