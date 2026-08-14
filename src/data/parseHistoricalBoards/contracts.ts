import type { Owner, Position } from "../../../config/league.js";

export type AcquisitionType = "keeper" | "auction" | "post-draft waiver";

export interface HistoricalBoardFile {
  season: number;
  path: string;
}

export interface HistoricalAuctionRecord {
  season: number;
  owner: Owner;
  rosterRow: number;
  originalPlayerName: string;
  normalizedPlayerName: string;
  position: Position;
  price: number;
  isKeeper: boolean;
  acquisitionType: AcquisitionType;
  source: string;
}
