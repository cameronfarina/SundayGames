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
  publicPrice?: number;
  seasonYear?: number;
  namesAnOwner: boolean;
  namesAPlayer: boolean;
}

const scanSlotHeaderRow = (headerRow: ParsedDelimitedRow): SlotHeaderScan => {
  const scan: SlotHeaderScan = { namesAnOwner: false, namesAPlayer: false };
  headerRow.cells.forEach((cell, cellIndex) => {
    const slotColumn = slotColumnForHeader(cell);
    if (slotColumn !== null) {
      scan[slotColumn] ??= cellIndex;
      return;
    }
    const column = columnForHeader(cell);
    if (
      column === "position"
      || column === "price"
      || column === "publicPrice"
      || column === "seasonYear"
    ) {
      scan[column] ??= cellIndex;
      return;
    }
    if (column === "owner") scan.namesAnOwner = true;
    if (column === "player") scan.namesAPlayer = true;
  });
  return scan;
};

/**
 * A slot sheet says what a draft slot cost. It carries no owner column. A
 * player column is allowed beside position and rank because exported ranking
 * sheets commonly name the player while still expressing a positional slot.
 */
export const slotPriceHeaderIndex = (
  headerRow: ParsedDelimitedRow,
): SlotPriceHeaderIndex | null => {
  const scan = scanSlotHeaderRow(headerRow);
  const { price, publicPrice, slot, position, positionRank, seasonYear } = scan;
  if (scan.namesAnOwner || price === undefined) return null;
  const optionalColumns = {
    ...(publicPrice === undefined ? {} : { publicPrice }),
    ...(seasonYear === undefined ? {} : { seasonYear }),
  };
  if (slot !== undefined && !scan.namesAPlayer) return { price, slot, ...optionalColumns };
  if (position === undefined || positionRank === undefined) return null;
  return { price, position, positionRank, ...optionalColumns };
};
