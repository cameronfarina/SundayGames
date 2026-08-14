import type { Position } from "../../../config/league.js";
import type { ProjectionRecord } from "../../projections.js";

export interface AuctionPricedPlayer {
  id?: string | number;
  name: string;
  position: Position;
  proTeamId?: number;
  price: number;
  scenarioPrice?: number;
  week1?: number;
  weeks?: Record<number, number>;
  weeks1To4: number;
  seasonProjection?: number;
  contextAdjustmentPercent?: number;
  contextEvidence?: readonly unknown[];
  contextEvidenceCount?: number;
}

export interface ReplacementPriceTier {
  count: number;
  price: number;
}

export interface BuildAuctionPlayerPoolOptions {
  pricedPlayers: readonly AuctionPricedPlayer[];
  projections: readonly ProjectionRecord[];
  excludedNames?: readonly string[];
  targetCount?: number;
  replacementPrice?: number;
  replacementPriceLadder?: readonly ReplacementPriceTier[];
}
