import { positions, type Position } from "../../../config/league.js";
import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import type { MockRun } from "../mockBatch.js";
import type { PositionCountCalibration } from "./contracts/calibration.js";
import { average, roundToTwo } from "./numeric.js";

const historicalPositionCount = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
  position: Position,
): number =>
  average(seasons.map(season =>
    records.filter(record =>
      record.season === season && record.position === position,
    ).length,
  ));

const mockPositionCount = (
  runs: readonly MockRun[],
  position: Position,
): number =>
  average(runs.map(run =>
    run.rosters
      .flatMap(roster => roster.players)
      .filter(player => player.position === position)
      .length,
  ));

export const summarizePositionCounts = (
  records: readonly HistoricalAuctionRecord[],
  runs: readonly MockRun[],
  seasons: readonly number[],
): PositionCountCalibration[] =>
  positions.map(position => {
    const historicalAverageCount = roundToTwo(
      historicalPositionCount(records, seasons, position),
    );
    const mockAverageCount = roundToTwo(mockPositionCount(runs, position));

    return {
      position,
      historicalAverageCount,
      mockAverageCount,
      delta: roundToTwo(mockAverageCount - historicalAverageCount),
    };
  });
