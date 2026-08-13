import { positions } from "../../config/league.js";
import { normalizePlayerName } from "../data/normalizePlayerName.js";
import type { ProjectionRecord } from "../projections.js";

export interface ProjectionRanking extends ProjectionRecord {
  normalizedName: string;
  projectionRank: number;
  rankGap?: number;
  rankBasis: "Weeks 1-4 projected fantasy points positional rank";
}

const missingEspnRank = Number.MAX_SAFE_INTEGER;

const compareProjectionRecords = (left: ProjectionRecord, right: ProjectionRecord): number =>
  right.weeks1To4 - left.weeks1To4 ||
  (left.espnRank ?? missingEspnRank) - (right.espnRank ?? missingEspnRank) ||
  left.name.localeCompare(right.name);

export const buildProjectionRankings = (
  records: readonly ProjectionRecord[],
): ProjectionRanking[] =>
  positions.flatMap(position =>
    records
      .filter(record => record.position === position)
      .sort(compareProjectionRecords)
      .map((record, index) => {
        const projectionRank = index + 1;

        return {
          ...record,
          normalizedName: normalizePlayerName(record.name),
          projectionRank,
          ...(record.espnRank === undefined ? {} : { rankGap: projectionRank - record.espnRank }),
          rankBasis: "Weeks 1-4 projected fantasy points positional rank",
        };
      }),
  );
