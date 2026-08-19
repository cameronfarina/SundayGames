import type { HistoricalSaleRecord } from "./saleContracts.js";

/**
 * Slot prices say what a draft slot cost, not what a named player cost. The
 * league that reported "RB1 went for $75" never said which running back that
 * was, so these records are stored under a label no fantasy team can hold and
 * under the slot itself as the player, and the audit trail reads that way too.
 * Borrowing the published board's name for the slot would put a sale on a
 * player's record that nobody reported.
 */
export const slotPriceOwnerDisplayName = "Slot prices (no owner)";

export const slotPriceLabel = (position: string, positionRank: number): string =>
  `${position}${String(positionRank)}`;

const slotPriceLabelPattern = /^(?:QB|RB|WR|TE|K|DST)\d+$/u;

export const isSlotPriceSaleRecord = (record: HistoricalSaleRecord): boolean =>
  record.ownerDisplayName === slotPriceOwnerDisplayName
  && slotPriceLabelPattern.test(record.playerName);
