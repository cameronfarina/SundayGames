import fs from "node:fs/promises";
import { historicalBoardFilesForEnvironment } from "./boardFiles.js";
import type { HistoricalAuctionRecord, HistoricalBoardFile } from "./contracts.js";
import { parseHistoricalBoardCsv } from "./parseBoard.js";
import { sortHistoricalRecords } from "./sortRecords.js";

export const loadHistoricalAuctionRecords = async (
  boards: readonly HistoricalBoardFile[] = historicalBoardFilesForEnvironment(),
): Promise<HistoricalAuctionRecord[]> => {
  const records = await Promise.all(
    boards.map(async board => parseHistoricalBoardCsv(await fs.readFile(board.path, "utf8"), board)),
  );

  return sortHistoricalRecords(records.flat());
};
