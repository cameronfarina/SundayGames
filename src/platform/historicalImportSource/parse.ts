import { resolveHistoricalImportDocumentLimits } from "../historicalImportLimits.js";
import type {
  HistoricalImportSourceOptions,
  HistoricalImportSourceParseResult,
  ParsedDelimitedRow,
} from "./contracts.js";
import { detectDelimiter } from "./delimiter.js";
import { nonEmptyRows, parseDelimitedRows } from "./delimitedRows.js";
import { fileHashFor, normalizeSourceText, wideAuctionSourceHashFor } from "./hashing.js";
import { headerIndexFor } from "./headers.js";
import { normalizedRowFor } from "./normalizedRow.js";
import { slotPriceHeaderIndex } from "./slotPriceHeaders.js";
import { rowsFromSlotPriceSource } from "./slotPrices.js";
import { sourceWarning } from "./warnings.js";
import { rowsFromWideAuctionSource, wideAuctionOwnerBlocks } from "./wideAuction.js";

const emptySourceResult = (fileHash: string): HistoricalImportSourceParseResult => ({
  rows: [],
  fileHash,
  sourceRowCount: 0,
  warnings: [sourceWarning("source_empty", "Historical import source is empty.")],
});

const firstRow = (rows: readonly ParsedDelimitedRow[]): ParsedDelimitedRow | undefined => rows[0];

export const parseHistoricalImportSource = (
  sourceText: string,
  options: HistoricalImportSourceOptions = {},
): HistoricalImportSourceParseResult => {
  const normalizedSourceText = normalizeSourceText(sourceText);
  const limits = resolveHistoricalImportDocumentLimits(options);
  const fileHash = fileHashFor(normalizedSourceText);
  const initialRows = nonEmptyRows(parseDelimitedRows(normalizedSourceText, ",", limits).rows);
  const headerRow = firstRow(initialRows);
  if (headerRow === undefined) return emptySourceResult(fileHash);

  const parsedSource = parseDelimitedRows(normalizedSourceText, detectDelimiter(headerRow), limits);
  const sourceRows = nonEmptyRows(parsedSource.rows);
  const mappedHeaderRow = firstRow(sourceRows);
  if (mappedHeaderRow === undefined) return emptySourceResult(fileHash);

  const blocks = wideAuctionOwnerBlocks(sourceRows);
  if (blocks !== null) {
    const inferKeepers = options.inferFirstRosterRowAsKeeper === true;
    const rows = rowsFromWideAuctionSource(sourceRows, blocks, inferKeepers);
    return {
      rows,
      fileHash: wideAuctionSourceHashFor(normalizedSourceText, inferKeepers),
      sourceRowCount: rows.length + 1,
      warnings: parsedSource.warnings,
    };
  }

  const slotIndex = slotPriceHeaderIndex(mappedHeaderRow);
  if (slotIndex !== null) {
    const warnings = [...parsedSource.warnings];
    return {
      rows: rowsFromSlotPriceSource(sourceRows.slice(1), slotIndex, warnings),
      fileHash,
      sourceRowCount: sourceRows.length,
      warnings,
    };
  }

  const headerIndex = headerIndexFor(mappedHeaderRow);
  const warnings = [...parsedSource.warnings, ...headerIndex.warnings];
  const rows = sourceRows
    .slice(1)
    .map(row => normalizedRowFor(row, headerIndex.headerMap, warnings));
  return { rows, fileHash, sourceRowCount: sourceRows.length, warnings };
};
