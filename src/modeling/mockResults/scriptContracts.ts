import type { Owner } from "../../../config/league.js";
import type { MockDraftScript, MockDraftScriptTargetMaxBid } from "../mockScript.js";

export interface MockResultsScriptTargetOutcome {
  owner: Owner;
  player: string;
  maxBid: number;
  runCount: number;
  draftedByOwnerCount: number;
  draftedByOwnerRate: number;
  draftedByOtherCount: number;
  undraftedCount: number;
  missedCount: number;
  averageSalePrice: number;
  minimumSalePrice: number;
  maximumSalePrice: number;
  averageOwnerRankWhenDrafted: number;
  averageOwnerWeek1WhenDrafted: number;
  averageOwnerSeasonStrengthWhenDrafted: number;
}

export interface MockResultsScriptBuildAroundOutcome {
  owner: Owner;
  player: string;
  price: number;
  runCount: number;
  draftedByOwnerCount: number;
  draftedByOwnerRate: number;
  draftedByOtherCount: number;
  undraftedCount: number;
  averageSalePrice: number;
  minimumSalePrice: number;
  maximumSalePrice: number;
  averageCamRank: number;
  averageCamWeek1Score: number;
  averageCamWeeks1To4Score: number;
  averageCamSeasonStrengthScore: number;
  averageCamBudgetRemaining: number;
  bestRunLabel: string;
  worstRunLabel: string;
}

export interface MockResultsScriptSummary {
  raw: string;
  label: string;
  buildAround?: MockDraftScript["buildAround"];
  buildAroundOutcomes?: MockResultsScriptBuildAroundOutcome[];
  targetMaxBids: MockDraftScriptTargetMaxBid[];
  targetOutcomes: MockResultsScriptTargetOutcome[];
  runsPerScenario?: number;
}
