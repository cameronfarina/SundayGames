import type { Position } from "../../../config/league.js";
import type { KeeperDeclaration, KeeperStatus } from "../../../config/keepers.js";
import type { BasePrice } from "../basePricing.js";

export type PositionAmounts = Record<Position, number>;
export type KeeperScenarioKey = "confirmedOnly" | "expected" | "highRetention";

export interface KeeperScenarioDefinition {
  key: KeeperScenarioKey;
  label: string;
  includedKeeperStatuses: readonly KeeperStatus[];
  keeperCounts?: PositionAmounts;
  averageKeeperCosts?: PositionAmounts;
}

export interface KeeperScenarioConfig {
  leagueTotalBudget: number;
  historicalOpenAuctionSpendBaseline: number;
  typicalKeeperCounts: PositionAmounts;
  scarcityRates: PositionAmounts;
  scenarios: readonly KeeperScenarioDefinition[];
}

export interface KeeperScenario {
  key: KeeperScenarioKey;
  label: string;
  includedKeeperStatuses: readonly KeeperStatus[];
  keeperCounts: PositionAmounts;
  totalKeeperCost: number;
  openAuctionDollars: number;
  globalFactor: number;
  positionFactors: PositionAmounts;
}

export interface ScenarioAdjustedPrice extends BasePrice {
  scenarioFactor: number;
  scenarioPrice: number;
}

export interface AppliedKeeperScenario {
  scenario: KeeperScenario;
  unavailableKeepers: KeeperDeclaration[];
  availablePrices: ScenarioAdjustedPrice[];
}
