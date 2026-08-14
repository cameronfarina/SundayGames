import type { Position } from "../../../config/league.js";

export const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
export const projectionDatasetId = "espn-projections-2026-weeks-1-4";

export const espnPositionById: Readonly<Record<number, Position | undefined>> = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  16: "DST",
};

interface EspnStatIds {
  passingYards: string;
  passingTouchdowns: string;
  rushingYards: string;
  rushingTouchdowns: string;
  receivingYards: string;
  receivingTouchdowns: string;
  receptions: string;
}

export const espnStatId: EspnStatIds = {
  passingYards: "3",
  passingTouchdowns: "4",
  rushingYards: "24",
  rushingTouchdowns: "25",
  receivingYards: "42",
  receivingTouchdowns: "43",
  receptions: "53",
};

export interface EspnProjectionStat {
  seasonId?: unknown;
  scoringPeriodId?: unknown;
  statSourceId?: unknown;
  statSplitTypeId?: unknown;
  stats?: unknown;
}

export interface EspnProjectionRecord {
  id: number;
  name: string;
  position: Position;
  seasonStat?: EspnProjectionStat;
  weeklyStats: ReadonlyMap<number, EspnProjectionStat>;
}

export interface EspnProjectionDataset {
  year: number;
  capturedAt: string;
  coveredWeeks: ReadonlySet<number>;
  projectionsByIdentity: ReadonlyMap<string, EspnProjectionRecord>;
}
