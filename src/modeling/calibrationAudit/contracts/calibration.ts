import type { Owner, Position } from "../../../../config/league.js";
import type { MockRun } from "../../mockBatch.js";

export interface CalibrationPriceTier {
  key: "elite" | "strong" | "starter" | "depth" | "dollar";
  label: string;
  minPrice: number;
  maxPrice?: number;
}

export interface PriceTierCalibration {
  key: CalibrationPriceTier["key"];
  label: string;
  historicalAveragePrice: number;
  mockAveragePrice: number;
  priceDelta: number;
  historicalAverageCount: number;
  mockAverageCount: number;
  countDelta: number;
}

export interface PositionSpendCalibration {
  position: Position;
  historicalAverageSpend: number;
  scenarioAverageSpendTarget: number;
  mockAverageSpend: number;
  delta: number;
  scenarioSpendDelta: number;
}

export interface PositionCountCalibration {
  position: Position;
  historicalAverageCount: number;
  mockAverageCount: number;
  delta: number;
}

export interface OwnerSpendCalibration {
  owner: Owner;
  historicalAverageAuctionSpend: number;
  scenarioAverageOpenAuctionBudget: number;
  mockAverageAuctionSpend: number;
  spendDelta: number;
  scenarioSpendDelta: number;
  historicalAverageTopTwoAuctionSpend: number;
  mockAverageTopTwoAuctionSpend: number;
  topTwoDelta: number;
}

export interface OverallCalibration {
  historicalAverageAuctionSpend: number;
  scenarioAverageOpenAuctionDollars: number;
  mockAverageAuctionSpend: number;
  auctionSpendDelta: number;
  scenarioAuctionSpendDelta: number;
  historicalAverageDollarPlayers: number;
  mockAverageDollarPlayers: number;
  dollarPlayerDelta: number;
}

export interface ScenarioCalibration {
  key: MockRun["keeperScenario"]["key"];
  label: string;
  runCount: number;
  invalidRosterCount: number;
  averagePickCount: number;
  scenarioAverageOpenAuctionDollars: number;
  mockAverageAuctionSpend: number;
  scenarioAuctionSpendDelta: number;
  leagueAverageBudgetRemaining: number;
  maxOwnerAverageBudgetRemaining: number;
}

export interface HighPriceVolumeCalibration {
  threshold: number;
  label: string;
  historicalAverageCount: number;
  historicalMaxCount: number;
  mockAverageCount: number;
  mockMaxCount: number;
  averageCountDelta: number;
  maxCountDelta: number;
}
