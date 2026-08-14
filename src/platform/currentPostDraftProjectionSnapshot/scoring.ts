import type { ScoringSettings } from "../leagueSeason.js";
import { espnStatId, type EspnProjectionStat } from "./contracts.js";
import { finiteNumber, recordFrom } from "./unknownValues.js";

const statValue = (stat: EspnProjectionStat, id: string): number => {
  const stats = recordFrom(stat.stats);
  return finiteNumber(stats?.[id]) ?? 0;
};

export const pointsFor = (stat: EspnProjectionStat, scoring: ScoringSettings): number =>
  statValue(stat, espnStatId.passingYards) * scoring.passingYards
  + statValue(stat, espnStatId.passingTouchdowns) * scoring.passingTouchdown
  + statValue(stat, espnStatId.rushingYards) * scoring.rushingYards
  + statValue(stat, espnStatId.rushingTouchdowns) * scoring.rushingTouchdown
  + statValue(stat, espnStatId.receivingYards) * scoring.receivingYards
  + statValue(stat, espnStatId.receivingTouchdowns) * scoring.receivingTouchdown
  + statValue(stat, espnStatId.receptions) * scoring.reception;
