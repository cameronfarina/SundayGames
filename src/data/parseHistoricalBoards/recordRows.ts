import path from "node:path";
import { cleanPlayerName, normalizePlayerName } from "../normalizePlayerName.js";
import { cleanCell, normalizePosition, parsePrice } from "./cells.js";
import type {
  AcquisitionType,
  HistoricalAuctionRecord,
  HistoricalBoardFile,
} from "./contracts.js";
import type { OwnerColumn } from "./ownerColumns.js";

export const parseRecordRows = (
  rows: string[][],
  ownerColumns: readonly OwnerColumn[],
  board: HistoricalBoardFile,
): HistoricalAuctionRecord[] => rows.flatMap(row => {
  const rosterRow = Number(cleanCell(row[0]));
  if (!Number.isInteger(rosterRow)) return [];

  return ownerColumns.flatMap(({ owner, index }): HistoricalAuctionRecord[] => {
    const originalPlayerName = cleanPlayerName(row[index + 2] ?? "");
    if (!originalPlayerName) return [];

    const price = parsePrice(row[index]);
    const position = normalizePosition(row[index + 1]);
    if (price === undefined || !position) {
      throw new Error(
        `Missing price or position for ${owner} row ${rosterRow} in ${board.path}.`,
      );
    }

    const isKeeper = rosterRow === 1;
    const acquisitionType: AcquisitionType = isKeeper ? "keeper" : "auction";
    return [{
      season: board.season,
      owner,
      rosterRow,
      originalPlayerName,
      normalizedPlayerName: normalizePlayerName(originalPlayerName),
      position,
      price,
      isKeeper,
      acquisitionType,
      source: path.basename(board.path),
    }];
  });
});
