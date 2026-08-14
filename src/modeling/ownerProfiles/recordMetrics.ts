import type { Position } from "../../../config/league.js";
import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import {
  maximumRepresentativeSpecialTeamsPrice,
  specialTeamsPositions,
} from "./constants.js";

const concentrationScale = 100;

const isSpecialTeamsPosition = (position: Position): position is "K" | "DST" =>
  specialTeamsPositions.some(candidate => candidate === position);

export const auctionRecords = (
  records: readonly HistoricalAuctionRecord[],
): HistoricalAuctionRecord[] => records.filter(record => record.acquisitionType === "auction");

export const spendForPosition = (
  records: readonly HistoricalAuctionRecord[],
  position: Position,
): number => records
  .filter(record => record.position === position)
  .reduce((total, record) => total + record.price, 0);

export const rosterCountForPosition = (
  records: readonly HistoricalAuctionRecord[],
  position: Position,
): number => records.filter(record => record.position === position).length;

export const normalSpecialTeamsSpend = (
  records: readonly HistoricalAuctionRecord[],
): number => auctionRecords(records)
  .filter(record => isSpecialTeamsPosition(record.position))
  .filter(record => record.price <= maximumRepresentativeSpecialTeamsPrice)
  .reduce((total, record) => total + record.price, 0);

export const topTwoConcentration = (
  records: readonly HistoricalAuctionRecord[],
): number => {
  const visibleRecords = records.filter(record => record.acquisitionType !== "post-draft waiver");
  const totalSpend = visibleRecords.reduce((total, record) => total + record.price, 0);
  if (totalSpend === 0) return 0;

  const topTwoSpend = visibleRecords
    .map(record => record.price)
    .sort((left, right) => right - left)
    .slice(0, 2)
    .reduce((total, price) => total + price, 0);
  return (topTwoSpend / totalSpend) * concentrationScale;
};

export const oneDollarPlayerCount = (
  records: readonly HistoricalAuctionRecord[],
): number => records.filter(record => record.price === 1).length;

export const keeperCost = (
  records: readonly HistoricalAuctionRecord[],
): number => records
  .filter(record => record.isKeeper)
  .reduce((total, record) => total + record.price, 0);
