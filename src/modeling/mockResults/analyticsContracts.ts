import type { DraftPlanStrategyCoach } from "../draftPlan.js";
import type { LiveDraftStrategyKey } from "../liveDraftStrategies.js";

export interface MockResultsStrategyAnalytics {
  strategyKey: LiveDraftStrategyKey;
  runCount: number;
  averageCamRank: number;
  bestCamRank: number;
  worstCamRank: number;
  averageCamWeek1Score: number;
  averageCamWeeks1To4Score: number;
  averageCamSeasonStrengthScore: number;
  averageCamSpend: number;
}

export interface MockResultsCamScoreRange {
  minimumWeek1Score: number;
  maximumWeek1Score: number;
  averageWeek1Score: number;
  minimumWeeks1To4Score: number;
  maximumWeeks1To4Score: number;
  averageWeeks1To4Score: number;
  bestRunLabel: string;
  worstRunLabel: string;
}

export interface MockResultsRosterPath {
  path: string;
  corePlayers: string[];
  count: number;
  draftedRate: number;
  averageWeek1Score: number;
  averageWeeks1To4Score: number;
  averageRank: number;
}

export interface MockResultsAnalytics {
  strategyLeaderboard: MockResultsStrategyAnalytics[];
  camScoreRange: MockResultsCamScoreRange;
  topCamRosterPaths: MockResultsRosterPath[];
  strategyCoach?: DraftPlanStrategyCoach;
}
