import { ownerOrder, type Owner } from "../../../config/league.js";
import type { HistoricalAuctionRecord } from "./contracts.js";

const ownerIndex = (owner: Owner): number => ownerOrder.indexOf(owner);

export const sortHistoricalRecords = (
  records: readonly HistoricalAuctionRecord[],
): HistoricalAuctionRecord[] => [...records].sort(
  (left, right) =>
    left.season - right.season ||
    ownerIndex(left.owner) - ownerIndex(right.owner) ||
    left.rosterRow - right.rosterRow,
);
