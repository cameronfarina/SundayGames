import path from "node:path";
import { ownerOrder } from "../../../config/league.js";
import type { HistoricalAuctionRecord, HistoricalBoardFile } from "./contracts.js";

const missingFinalSlot: Omit<
  HistoricalAuctionRecord,
  "season" | "owner" | "source"
> = {
  rosterRow: 16,
  originalPlayerName: "Seattle Seahawks",
  normalizedPlayerName: "Seattle Seahawks",
  position: "DST",
  price: 1,
  isKeeper: false,
  acquisitionType: "post-draft waiver",
};

export const repairMissing2023Slot = (
  records: HistoricalAuctionRecord[],
  board: HistoricalBoardFile,
): HistoricalAuctionRecord[] => {
  if (board.season !== 2023) return records;

  const ownersMissingFinalSlot = ownerOrder.filter(owner =>
    !records.some(record => record.owner === owner && record.rosterRow === missingFinalSlot.rosterRow));
  if (ownersMissingFinalSlot.length > 1) {
    throw new Error(`Historical board ${board.path} is missing multiple final roster slots.`);
  }

  const missingOwner = ownersMissingFinalSlot[0];
  if (!missingOwner) return records;

  const selectedNames = new Set(records.map(record => record.normalizedPlayerName));
  if (selectedNames.has(missingFinalSlot.normalizedPlayerName)) {
    throw new Error(`${missingFinalSlot.originalPlayerName} was already selected in 2023.`);
  }

  return [...records, {
    ...missingFinalSlot,
    owner: missingOwner,
    season: board.season,
    source: path.basename(board.path),
  }];
};
