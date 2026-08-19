import { normalizeHeader } from "./cells.js";
import { slotHeaderAliases } from "./constants.js";
import type {
  ParsedDelimitedRow,
  SlotPriceHeaderIndex,
  SlotPriceSlotColumn,
} from "./contracts.js";
import { columnForHeader } from "./headers.js";

const slotColumns: readonly SlotPriceSlotColumn[] = ["slot", "positionRank"];

const slotColumnForHeader = (header: string): SlotPriceSlotColumn | null => {
  const normalizedHeader = normalizeHeader(header);
  for (const column of slotColumns) {
    if (slotHeaderAliases[column].has(normalizedHeader)) return column;
  }
  return null;
};

interface SlotHeaderScan {
  slot?: number;
  position?: number;
  positionRank?: number;
  price?: number;
  seasonYear?: number;
  namesAnOwnerOrPlayer: boolean;
}

const scanSlotHeaderRow = (headerRow: ParsedDelimitedRow): SlotHeaderScan => {
  const scan: SlotHeaderScan = { namesAnOwnerOrPlayer: false };
  headerRow.cells.forEach((cell, cellIndex) => {
    const slotColumn = slotColumnForHeader(cell);
    if (slotColumn !== null) {
      scan[slotColumn] ??= cellIndex;
      return;
    }
    const column = columnForHeader(cell);
    if (column === "position" || column === "price" || column === "seasonYear") {
      scan[column] ??= cellIndex;
      return;
    }
    if (column === "player" || column === "owner") scan.namesAnOwnerOrPlayer = true;
  });
  return scan;
};

/**
 * A slot sheet says what a draft slot cost. It carries no owner column and no
 * player column, which is what separates it from the header-mapped layout.
 */
export const slotPriceHeaderIndex = (
  headerRow: ParsedDelimitedRow,
): SlotPriceHeaderIndex | null => {
  const scan = scanSlotHeaderRow(headerRow);
  const { price, slot, position, positionRank, seasonYear } = scan;
  if (scan.namesAnOwnerOrPlayer || price === undefined) return null;
  const season = seasonYear === undefined ? {} : { seasonYear };
  if (slot !== undefined) return { price, slot, ...season };
  if (position === undefined || positionRank === undefined) return null;
  return { price, position, positionRank, ...season };
};
