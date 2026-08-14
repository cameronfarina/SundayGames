import type { KeeperDeclaration } from "../../../../config/keepers.js";
import type { Owner } from "../../../../config/league.js";
import type { DraftRoomRanking } from "../../../data/draftRoomRankings.js";
import type { HistoricalAuctionRecord } from "../../../data/parseHistoricalBoards.js";
import type { ProjectionRecord } from "../../../projections.js";
import type { PricingConfig } from "../../basePricing.js";
import type { KeeperScenarioKey } from "../../keeperInflation.js";
import type { LiveDraftStrategyKey } from "../../liveDraftStrategies.js";

export interface BuildLiveDraftStateOptions {
  projections: readonly ProjectionRecord[];
  historicalRecords: readonly HistoricalAuctionRecord[];
  keepers?: readonly KeeperDeclaration[];
  scenarioKey?: KeeperScenarioKey;
  strategyKey?: LiveDraftStrategyKey;
  watchOwner?: Owner;
  commands?: readonly string[];
  pricingConfig?: PricingConfig;
  targetLimit?: number;
  draftRoomRankings?: readonly DraftRoomRanking[];
}
