import fs from "node:fs/promises";
import { leagueConfig, type Position } from "../config/league.js";
import {
  applySeasonLongProjectionCalibrations,
  loadSeasonLongProjectionInputs,
  type SeasonLongProjectionCalibration,
} from "./modeling/seasonLongProjection.js";

const positionMap: Record<number, Position | undefined> = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  16: "DST",
};

export interface ProjectionRecord {
  id: number;
  name: string;
  position: Position;
  proTeamId?: number;
  weeks: Record<number, number>;
  weeks1To4: number;
  seasonProjection?: number;
  espnRank?: number;
  espnAuctionValue?: number;
  projectionCalibration?: SeasonLongProjectionCalibration;
}

export interface LoadCurrentProjectionsOptions {
  projectionPath?: string;
  seasonLongProjectionPath?: string;
}

export const defaultProjectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
export const defaultSeasonLongProjectionPath = "data/raw/season-long-projections-2026.json";

export type { SeasonLongProjectionCalibration } from "./modeling/seasonLongProjection.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const arrayValue = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

const projectionStatFor = (
  value: unknown,
  week: number,
  splitType: number,
): value is Record<string, unknown> => isRecord(value)
  && value.seasonId === 2026
  && value.scoringPeriodId === week
  && value.statSourceId === 1
  && value.statSplitTypeId === splitType;

export const loadEspnWeeksOneToFour = async (path: string): Promise<ProjectionRecord[]> => {
  const parsed: unknown = JSON.parse(await fs.readFile(path, "utf8"));
  const records = new Map<number, ProjectionRecord>();
  if (!isRecord(parsed)) return [];

  for (const weekEntry of arrayValue(parsed.weeks)) {
    if (!isRecord(weekEntry)) continue;
    const week = Number(weekEntry.week);
    if (!isRecord(weekEntry.data)) continue;
    for (const entry of arrayValue(weekEntry.data.players)) {
      if (!isRecord(entry) || !isRecord(entry.player)) continue;
      const player = entry.player;
      const id = Number(player.id ?? entry.id);
      const position = positionMap[Number(player.defaultPositionId)];
      if (!id || !position) continue;

      const stats = arrayValue(player.stats);
      const stat = stats.find(candidate => projectionStatFor(candidate, week, 1));
      const seasonProjectionStat = stats.find(candidate => projectionStatFor(candidate, 0, 0));

      const existing: ProjectionRecord = records.get(id) ?? {
        id,
        name: String(player.fullName ?? ""),
        position,
        ...(typeof player.proTeamId === "number" ? { proTeamId: player.proTeamId } : {}),
        weeks: {},
        weeks1To4: 0,
      };

      existing.weeks[week] = Number(stat?.appliedTotal ?? 0);
      existing.weeks1To4 = Object.values(existing.weeks).reduce((sum, points) => sum + points, 0);
      if (typeof seasonProjectionStat?.appliedTotal === "number") {
        existing.seasonProjection = seasonProjectionStat.appliedTotal;
      }
      const rankTypes = isRecord(player.draftRanksByRankType) ? player.draftRanksByRankType : undefined;
      const ppr = isRecord(rankTypes?.PPR) ? rankTypes.PPR : undefined;
      if (typeof ppr?.rank === "number") existing.espnRank = ppr.rank;
      if (typeof ppr?.auctionValue === "number") existing.espnAuctionValue = ppr.auctionValue;
      records.set(id, existing);
    }
  }

  return [...records.values()];
};

export const loadCurrentProjections = async ({
  projectionPath = defaultProjectionPath,
  seasonLongProjectionPath = defaultSeasonLongProjectionPath,
}: LoadCurrentProjectionsOptions = {}): Promise<ProjectionRecord[]> => {
  const [projections, seasonLongInputs] = await Promise.all([
    loadEspnWeeksOneToFour(projectionPath),
    loadSeasonLongProjectionInputs(seasonLongProjectionPath),
  ]);

  return applySeasonLongProjectionCalibrations(
    projections,
    seasonLongInputs,
    leagueConfig.scoring,
  );
};
