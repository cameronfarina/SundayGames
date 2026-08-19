import type { NormalizedHistoricalImportRow } from "../historicalImports.js";
import {
  slotPriceLabel,
  slotPriceOwnerDisplayName,
} from "../historicalImports/slotPriceProvenance.js";
import {
  cleanCell,
  normalizeHistoricalPosition,
  parseIntegerCell,
  parsePriceDollars,
} from "./cells.js";
import type {
  HistoricalImportSourceWarning,
  ParsedDelimitedRow,
  SlotPriceHeaderIndex,
} from "./contracts.js";
import { publicPriceForSlot } from "./publicBaseline.js";
import { sourceWarning } from "./warnings.js";

const combinedSlotPattern = /^([A-Za-z/]+)[\s-]*(\d+)$/u;

interface SlotIdentity {
  position: string;
  positionRank: number | undefined;
  sourceLabel: string;
}

const separateSlotIdentity = (
  row: ParsedDelimitedRow,
  positionIndex: number,
  rankIndex: number,
): SlotIdentity => {
  const positionCell = cleanCell(row.cells[positionIndex]);
  const rankCell = cleanCell(row.cells[rankIndex]);
  return {
    position: normalizeHistoricalPosition(positionCell).toUpperCase(),
    positionRank: parseIntegerCell(rankCell),
    sourceLabel: `${positionCell} ${rankCell}`.trim(),
  };
};

const combinedSlotIdentity = (sourceLabel: string): SlotIdentity => {
  const match = combinedSlotPattern.exec(sourceLabel);
  return {
    position: normalizeHistoricalPosition(match?.[1] ?? sourceLabel).toUpperCase(),
    positionRank: match === null ? undefined : parseIntegerCell(match[2] ?? ""),
    sourceLabel,
  };
};

const slotIdentityFor = (
  row: ParsedDelimitedRow,
  index: SlotPriceHeaderIndex,
): SlotIdentity => index.slot === undefined
  ? separateSlotIdentity(row, index.position, index.positionRank)
  : combinedSlotIdentity(cleanCell(row.cells[index.slot]));

const slotCellIndex = (index: SlotPriceHeaderIndex): number =>
  index.slot ?? index.position;

const isEmptySlotRow = (row: ParsedDelimitedRow, index: SlotPriceHeaderIndex): boolean =>
  cleanCell(row.cells[index.price]).length === 0
  && cleanCell(row.cells[slotCellIndex(index)]).length === 0;

const normalizedSlotPriceRow = (
  row: ParsedDelimitedRow,
  index: SlotPriceHeaderIndex,
  warnings: HistoricalImportSourceWarning[],
): NormalizedHistoricalImportRow => {
  const { position, positionRank, sourceLabel } = slotIdentityFor(row, index);
  const priceDollars = parsePriceDollars(cleanCell(row.cells[index.price]));
  const seasonYear = index.seasonYear === undefined
    ? undefined
    : parseIntegerCell(cleanCell(row.cells[index.seasonYear]));
  const rank = positionRank !== undefined && positionRank >= 1 ? positionRank : undefined;
  if (rank === undefined) {
    warnings.push(sourceWarning(
      "invalid_position_rank",
      `Row ${String(row.rowNumber)} has no position rank in "${sourceLabel}". Name a slot such as RB1, or give a position column and a rank column.`,
      row.rowNumber,
      "positionRank",
    ));
  }
  // Kickers, defenses and the deep end of every position are worth nothing on
  // the published board, so those slots keep their price and stay out of the
  // calibration rather than claiming a published value of zero.
  const publicPriceDollars = rank === undefined
    ? undefined
    : publicPriceForSlot(position, rank);

  return {
    sourceRowNumber: row.rowNumber,
    ownerDisplayName: slotPriceOwnerDisplayName,
    ...(rank === undefined ? {} : { playerName: slotPriceLabel(position, rank) }),
    ...(position.length > 0 ? { position } : {}),
    ...(priceDollars === undefined ? {} : { priceDollars }),
    ...(publicPriceDollars === undefined ? {} : { publicPriceDollars }),
    ...(seasonYear === undefined ? {} : { seasonYear }),
    keeper: false,
    acquisitionType: "auction",
  };
};

export const rowsFromSlotPriceSource = (
  rows: readonly ParsedDelimitedRow[],
  index: SlotPriceHeaderIndex,
  warnings: HistoricalImportSourceWarning[],
): NormalizedHistoricalImportRow[] => rows
  .filter(row => !isEmptySlotRow(row, index))
  .map(row => normalizedSlotPriceRow(row, index, warnings));
