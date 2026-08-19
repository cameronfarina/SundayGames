import type { NormalizedHistoricalImportRow } from "../historicalImports.js";
import {
  slotPriceLabel,
  slotPriceOwnerDisplayName,
} from "../historicalImports/slotPriceProvenance.js";
import { cleanCell, normalizeHistoricalPosition, parsePriceDollars } from "./cells.js";
import type { ParsedDelimitedRow } from "./contracts.js";
import { columnForHeader } from "./headers.js";
import { publicPriceForSlot } from "./publicBaseline.js";

interface WideSlotPriceBlock {
  position: number;
  player: number;
  price: number;
}

const normalizedPosition = (value: string): string => {
  const position = normalizeHistoricalPosition(value).toUpperCase();
  return position === "D/ST" ? "DST" : position;
};

export const wideSlotPriceBlocks = (
  headerRow: ParsedDelimitedRow,
): readonly WideSlotPriceBlock[] | null => {
  if (headerRow.cells.length < 6 || headerRow.cells.length % 3 !== 0) return null;
  const blocks: WideSlotPriceBlock[] = [];
  for (let index = 0; index < headerRow.cells.length; index += 3) {
    if (
      columnForHeader(headerRow.cells[index] ?? "") !== "position"
      || columnForHeader(headerRow.cells[index + 1] ?? "") !== "player"
      || columnForHeader(headerRow.cells[index + 2] ?? "") !== "price"
    ) return null;
    blocks.push({ position: index, player: index + 1, price: index + 2 });
  }
  return blocks.length >= 2 ? blocks : null;
};

export const rowsFromWideSlotPriceSource = (
  rows: readonly ParsedDelimitedRow[],
  blocks: readonly WideSlotPriceBlock[],
): NormalizedHistoricalImportRow[] => {
  const ranksByPosition = new Map<string, number>();
  const normalizedRows: NormalizedHistoricalImportRow[] = [];

  for (const row of rows) {
    for (const block of blocks) {
      const positionCell = cleanCell(row.cells[block.position]);
      const playerCell = cleanCell(row.cells[block.player]);
      const priceCell = cleanCell(row.cells[block.price]);
      if (positionCell.length === 0 && playerCell.length === 0 && priceCell.length === 0) continue;

      const position = normalizedPosition(positionCell);
      const rank = (ranksByPosition.get(position) ?? 0) + 1;
      ranksByPosition.set(position, rank);
      const priceDollars = parsePriceDollars(priceCell);
      const publicPriceDollars = publicPriceForSlot(position, rank);
      normalizedRows.push({
        sourceRowNumber: row.rowNumber,
        ownerDisplayName: slotPriceOwnerDisplayName,
        playerName: slotPriceLabel(position, rank),
        position,
        ...(priceDollars === undefined ? {} : { priceDollars }),
        ...(publicPriceDollars === undefined ? {} : { publicPriceDollars }),
        keeper: false,
        acquisitionType: "auction",
      });
    }
  }
  return normalizedRows;
};
