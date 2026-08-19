import type { NormalizedHistoricalImportRow } from "../historicalImports.js";
import { cleanCell, normalizeHeader, parsePriceDollars, wideAuctionPosition } from "./cells.js";
import { rosterRowPattern } from "./constants.js";
import type { ParsedDelimitedRow, WideAuctionOwnerBlock } from "./contracts.js";
import { publicPriceForPlayerName } from "./publicBaseline.js";

const isWideAuctionRosterRow = (row: ParsedDelimitedRow): boolean =>
  rosterRowPattern.test(cleanCell(row.cells[0]));

export const wideAuctionOwnerBlocks = (
  rows: readonly ParsedDelimitedRow[],
): WideAuctionOwnerBlock[] | null => {
  const headerRow = rows.find(row => normalizeHeader(row.cells[0] ?? "") === "team");
  if (headerRow === undefined) return null;
  const rosterRows = rows.filter(isWideAuctionRosterRow);
  const blocks: WideAuctionOwnerBlock[] = [];

  headerRow.cells.forEach((cell, priceColumnIndex) => {
    const ownerDisplayName = cleanCell(cell);
    if (priceColumnIndex === 0 || ownerDisplayName.length === 0) return;
    const hasRosterRecord = rosterRows.some(row =>
      wideAuctionPosition(row.cells[priceColumnIndex + 1]) !== null
      && cleanCell(row.cells[priceColumnIndex + 2]).length > 0
    );
    if (hasRosterRecord) blocks.push({ ownerDisplayName, priceColumnIndex });
  });
  return blocks.length >= 2 ? blocks : null;
};

const normalizedWideAuctionRow = (
  sourceRow: ParsedDelimitedRow,
  block: WideAuctionOwnerBlock,
  sourceRowNumber: number,
  inferKeeper: boolean,
): NormalizedHistoricalImportRow | null => {
  const priceValue = cleanCell(sourceRow.cells[block.priceColumnIndex]);
  const positionValue = cleanCell(sourceRow.cells[block.priceColumnIndex + 1]);
  const position = wideAuctionPosition(sourceRow.cells[block.priceColumnIndex + 1]);
  const playerName = cleanCell(sourceRow.cells[block.priceColumnIndex + 2]);
  if (priceValue.length === 0 && positionValue.length === 0 && playerName.length === 0) return null;

  const keeper = inferKeeper && cleanCell(sourceRow.cells[0]) === "1";
  const priceDollars = parsePriceDollars(priceValue);
  // A wide sheet has no public-value column, so without this the layout carries
  // no published price at all and every sale it produces is skipped by the
  // inflation calibration.
  const publicPriceDollars = position === null
    ? undefined
    : publicPriceForPlayerName(playerName, position);
  return {
    sourceRowNumber,
    ownerDisplayName: block.ownerDisplayName,
    ...(inferKeeper ? { keeper, acquisitionType: keeper ? "keeper" : "auction" } : {}),
    ...(playerName.length > 0 ? { playerName } : {}),
    ...(position !== null ? { position } : positionValue.length > 0 ? { position: positionValue } : {}),
    ...(priceDollars === undefined ? {} : { priceDollars }),
    ...(publicPriceDollars === undefined ? {} : { publicPriceDollars }),
  };
};

export const rowsFromWideAuctionSource = (
  rows: readonly ParsedDelimitedRow[],
  blocks: readonly WideAuctionOwnerBlock[],
  inferFirstRosterRowAsKeeper: boolean,
): NormalizedHistoricalImportRow[] => {
  const normalizedRows: NormalizedHistoricalImportRow[] = [];
  for (const sourceRow of rows) {
    if (!isWideAuctionRosterRow(sourceRow)) continue;
    for (const block of blocks) {
      const row = normalizedWideAuctionRow(
        sourceRow,
        block,
        normalizedRows.length + 2,
        inferFirstRosterRowAsKeeper,
      );
      if (row !== null) normalizedRows.push(row);
    }
  }
  return normalizedRows;
};
