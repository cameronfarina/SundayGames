import type { HistoricalAuctionRecord, HistoricalBoardFile } from "./contracts.js";
import { parseCsv } from "./csv.js";
import { buildOwnerColumns } from "./ownerColumns.js";
import { parseRecordRows } from "./recordRows.js";
import { repairMissing2023Slot } from "./repair2023.js";
import { sortHistoricalRecords } from "./sortRecords.js";

export const parseHistoricalBoardCsv = (
  csv: string,
  board: HistoricalBoardFile,
): HistoricalAuctionRecord[] => {
  const rows = parseCsv(csv);
  const header = rows[0];
  if (!header) throw new Error(`Historical board ${board.path} is empty.`);

  const ownerColumns = buildOwnerColumns(header, board.path);
  const records = parseRecordRows(rows, ownerColumns, board);
  return sortHistoricalRecords(repairMissing2023Slot(records, board));
};
