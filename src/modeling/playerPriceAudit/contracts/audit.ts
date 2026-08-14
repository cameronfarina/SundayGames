import type { KeeperDeclaration } from "../../../../config/keepers.js";
import type { Position } from "../../../../config/league.js";
import type {
  PlayerContextEvidence,
  PlayerContextNotes,
  PlayerContextSignals,
} from "../../../../config/playerContext.js";
import type { HistoricalAuctionRecord } from "../../../data/parseHistoricalBoards.js";
import type {
  ProjectionRecord,
  SeasonLongProjectionCalibration,
} from "../../../projections.js";
import type { PricingConfig } from "../../basePricing.js";
import type { KeeperScenarioKey } from "../../keeperInflation.js";

export interface BuildPlayerPriceAuditOptions {
  playerName: string;
  projections: readonly ProjectionRecord[];
  historicalRecords: readonly HistoricalAuctionRecord[];
  keepers: readonly KeeperDeclaration[];
  scenarioKey?: KeeperScenarioKey;
  runs?: number;
  seedPrefix?: string;
  pricingConfig?: PricingConfig;
}

export interface PlayerAuditIdentity {
  name: string;
  position: Position;
  normalizedName: string;
  week1: number;
  weeks1To4: number;
  seasonProjection: number | null;
  projectionCalibration?: SeasonLongProjectionCalibration;
}

export interface PlayerAuditPricing {
  rawPublicAnchorValue: number | null;
  publicAnchorValue: number;
  projectionRank: number;
  espnRank: number | null;
  rankGap: number | null;
  rankGapAdjustment: number;
  positionMultiplier: number;
  marketPressure: number;
  anchoredPrice: number;
  projectionFloorPrice: number;
  preSustainabilityPrice: number;
  sustainabilityFactor: number;
  sustainabilityNote?: string;
  contextAdjustmentFactor: number;
  contextAdjustmentPercent: number;
  contextSignals: PlayerContextSignals;
  contextNotes?: PlayerContextNotes;
  contextEvidence: readonly PlayerContextEvidence[];
  rawPrice: number;
  hardCeiling: number;
  basePrice: number;
}
