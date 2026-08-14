import type { Owner, Position } from "../../../config/league.js";
import type { DraftRoomRanking } from "../../data/draftRoomRankings.js";
import type { ParsedLiveDraftSaleCommand, LiveDraftPlayerSource } from "./contracts.js";

export interface LiveDraftPlayerRecord {
  name: string;
  normalizedName: string;
  position: Position;
  expectedPrice: number;
  week1: number;
  weeks1To4: number;
  seasonProjection: number;
  source: LiveDraftPlayerSource;
  teamAbbreviation?: string;
  byeWeek?: number;
  projectionRank?: number;
  espnRank?: number;
  draftRoomRank?: DraftRoomRanking;
}

export interface ResolvedSale {
  owner: Owner;
  player: LiveDraftPlayerRecord;
  parsed: ParsedLiveDraftSaleCommand;
}
