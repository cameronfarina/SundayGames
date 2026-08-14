import type { Position } from "../../../config/league.js";

export type HistoricalAcquisitionType = "auction" | "keeper";

export interface HistoricalSaleRecord {
  id: string;
  batchId: string;
  leagueId: string;
  leagueSeasonId: string;
  seasonYear: number;
  rowNumber: number;
  ownerId: string;
  ownerDisplayName: string;
  playerId: string;
  playerName: string;
  position: Position;
  priceDollars: number;
  publicPriceDollars?: number;
  keeper: boolean;
  acquisitionType: HistoricalAcquisitionType;
}
