import type { Owner } from "../../../../config/league.js";
import type { HistoricalAuctionRecord } from "../../../data/parseHistoricalBoards.js";
import type { MockBatch } from "../../mockBatch.js";
import type {
  HighPriceVolumeCalibration,
  OverallCalibration,
  OwnerSpendCalibration,
  PositionCountCalibration,
  PositionSpendCalibration,
  PriceTierCalibration,
  ScenarioCalibration,
} from "./calibration.js";
import type { CalibrationGates } from "./gates.js";

export interface CalibrationDeltaSummary {
  key: string;
  label: string;
  target: number;
  actual: number;
  delta: number;
}

export interface OwnerBudgetRemainingSummary {
  owner: Owner;
  averageBudgetRemaining: number;
}

export interface BudgetRemainingCalibrationSummary {
  leagueAverageBudgetRemaining: number;
  ownersWithAverageBudgetRemaining: OwnerBudgetRemainingSummary[];
}

export interface CalibrationSummary {
  runCount: number;
  scenarioKeys: MockBatch["options"]["scenarioKeys"];
  runsPerScenario: number;
  largestPriceTierCountDeltas: CalibrationDeltaSummary[];
  largestPositionCountDeltas: CalibrationDeltaSummary[];
  largestPositionSpendDeltas: CalibrationDeltaSummary[];
  largestOwnerSpendDeltas: CalibrationDeltaSummary[];
  budgetRemaining: BudgetRemainingCalibrationSummary;
}

export interface HistoricalCalibrationAudit {
  runCount: number;
  historicalSeasons: number[];
  summary: CalibrationSummary;
  priceTiers: PriceTierCalibration[];
  highPriceVolumes: HighPriceVolumeCalibration[];
  positionCounts: PositionCountCalibration[];
  positionSpend: PositionSpendCalibration[];
  ownerSpend: OwnerSpendCalibration[];
  scenarios: ScenarioCalibration[];
  overall: OverallCalibration;
  gates: CalibrationGates;
}

export interface BuildHistoricalCalibrationAuditOptions {
  historicalRecords: readonly HistoricalAuctionRecord[];
  batch: MockBatch;
}
