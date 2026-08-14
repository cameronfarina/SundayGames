import type { Position } from "../../../config/league.js";

export type DraftRoomRankingScoring = "standard" | "half-ppr" | "ppr" | "unknown";
export type DraftRoomRankingProvider = "espn" | "sleeper" | "yahoo" | "cbs";

export interface DraftRoomRanking {
  sourceId: string;
  sourceLabel: string;
  scoring: DraftRoomRankingScoring;
  name: string;
  normalizedName: string;
  team: string;
  position: Position;
  providerRanks: Partial<Record<DraftRoomRankingProvider, number>>;
  byeWeek?: number;
  adpRank?: number;
  fantasyProsRank?: number;
  platformRank?: number;
  platformGapVsFantasyPros?: number;
  landmineScore?: number;
  round?: number;
  pick?: number;
}
