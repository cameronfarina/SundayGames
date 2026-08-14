import type { KeeperScenarioKey } from "../../keeperInflation.js";

export interface PlayerAuditScenario {
  key: KeeperScenarioKey;
  label: string;
  available: boolean;
  totalKeeperCost: number;
  openAuctionDollars: number;
  globalFactor: number;
  positionFactor: number;
  scenarioFactor: number;
  scenarioPrice: number;
  unavailableReason?: string;
}
