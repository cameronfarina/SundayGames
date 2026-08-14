import type { KeeperDeclaration } from "../../../config/keepers.js";
import type { BasePrice } from "../basePricing.js";
import type {
  KeeperScenarioKey,
  ScenarioAdjustedPrice,
} from "../keeperInflation.js";

export interface BuildKeeperScenarioSensitivityReportOptions {
  prices: readonly BasePrice[];
  keepers: readonly KeeperDeclaration[];
  limit?: number;
}

export interface KeeperScenarioPlayerState {
  available: boolean;
  scenarioPrice: number | null;
  scenarioFactor: number | null;
  keeperRemoved: boolean;
  unavailableReason?: string;
}

export interface KeeperScenarioPlayerStates {
  confirmedOnly: KeeperScenarioPlayerState;
  expected: KeeperScenarioPlayerState;
  highRetention: KeeperScenarioPlayerState;
}

export interface KeeperScenarioSensitivityRow {
  rank: number;
  player: string;
  position: BasePrice["position"];
  pricedPool: boolean;
  basePrice: number | null;
  publicAnchorValue: number | null;
  scenarios: KeeperScenarioPlayerStates;
  priceSpread: number | null;
  expectedVsConfirmedDelta: number | null;
  highRetentionVsExpectedDelta: number | null;
  keeperRemoved: boolean;
  keeperRemovalChanged: boolean;
  availabilityChanged: boolean;
  unavailableScenarios: KeeperScenarioKey[];
  keeperRemovalScenarios: KeeperScenarioKey[];
  sortScore: number;
}

export interface KeeperScenarioSensitivitySummary {
  scenarioKeys: KeeperScenarioKey[];
  playerCount: number;
  reportedPlayerCount: number;
  limit: number;
  truncated: boolean;
  keeperRemovedCount: number;
  keeperRemovalChangeCount: number;
  availabilityChangeCount: number;
  reportedKeeperRemovalChangeCount: number;
  reportedAvailabilityChangeCount: number;
  pricedPlayerCount: number;
  unpricedKeeperCount: number;
  maxPriceSpread: number;
  averagePriceSpread: number;
}

export interface KeeperScenarioSensitivityReport {
  summary: KeeperScenarioSensitivitySummary;
  rows: KeeperScenarioSensitivityRow[];
}

export interface ScenarioPriceMaps {
  confirmedOnly: ReadonlyMap<string, ScenarioAdjustedPrice>;
  expected: ReadonlyMap<string, ScenarioAdjustedPrice>;
  highRetention: ReadonlyMap<string, ScenarioAdjustedPrice>;
}

export interface KeeperReasonMaps {
  confirmedOnly: ReadonlyMap<string, string>;
  expected: ReadonlyMap<string, string>;
  highRetention: ReadonlyMap<string, string>;
}

export interface ScenarioResources {
  scenarioPriceMaps: ScenarioPriceMaps;
  keeperReasonMaps: KeeperReasonMaps;
}

export type UnrankedSensitivityRow = Omit<KeeperScenarioSensitivityRow, "rank">;
export type CsvValue = string | number | boolean | null | undefined;
