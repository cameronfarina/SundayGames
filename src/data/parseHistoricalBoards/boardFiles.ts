import path from "node:path";
import type { HistoricalBoardFile } from "./contracts.js";

const historicalSeasons = [2023, 2024, 2025];

export const historicalBoardFiles: HistoricalBoardFile[] = historicalSeasons.map(season => ({
  season,
  path: `data/fixtures/historical/auction-${season}.synthetic.csv`,
}));

export const historicalBoardFilesForEnvironment = (
  env: NodeJS.ProcessEnv = process.env,
): HistoricalBoardFile[] => {
  const privateDirectory = env.MOCKD_HISTORICAL_BOARD_DIRECTORY?.trim();
  if (!privateDirectory) return historicalBoardFiles;

  return historicalSeasons.map(season => ({
    season,
    path: path.join(privateDirectory, `${season}-board.csv`),
  }));
};
