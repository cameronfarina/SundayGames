import type {
  InitialRostersByOwner,
  OwnerAuctionBehaviors,
  OwnerDemandMultipliers,
  OwnerRosterMaximums,
} from "../auctionEngine.js";
import type { KeeperScenario } from "../keeperInflation.js";
import type { Player } from "../../types.js";
import type { MockInputCounts } from "./contracts.js";

export interface PreparedScenario {
  scenario: KeeperScenario;
  initialRostersByOwner: InitialRostersByOwner;
  auctionPlayers: Player[];
  inputCounts: MockInputCounts;
}

export interface MockPreparation {
  scenarios: PreparedScenario[];
  ownerDemandMultipliers: OwnerDemandMultipliers;
  ownerBehaviors: OwnerAuctionBehaviors;
  ownerRosterMaximums: OwnerRosterMaximums;
}
