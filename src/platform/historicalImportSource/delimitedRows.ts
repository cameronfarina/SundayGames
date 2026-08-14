import {
  assertHistoricalImportCellCount,
  assertHistoricalImportRowCount,
  resolveHistoricalImportDocumentLimits,
} from "../historicalImportLimits.js";
import { cleanCell } from "./cells.js";
import type {
  HistoricalImportSourceDelimiter,
  ParsedDelimitedRow,
  ParsedDelimitedSource,
} from "./contracts.js";
import { sourceWarning } from "./warnings.js";

export const parseDelimitedRows = (
  sourceText: string,
  delimiter: HistoricalImportSourceDelimiter,
  limits = resolveHistoricalImportDocumentLimits(),
): ParsedDelimitedSource => {
  const rows: ParsedDelimitedRow[] = [];
  const warnings = [];
  let cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  let lineNumber = 1;
  let currentRowNumber = 1;
  let cellCount = 0;

  const pushCell = (): void => {
    cellCount += 1;
    assertHistoricalImportCellCount(cellCount, limits);
    cells.push(cleanCell(cell));
    cell = "";
  };
  const pushRow = (): void => {
    pushCell();
    assertHistoricalImportRowCount(rows.length + 1, limits);
    rows.push({ rowNumber: currentRowNumber, cells });
    cells = [];
    currentRowNumber = lineNumber + 1;
  };

  for (let index = 0; index < sourceText.length; index += 1) {
    const character = sourceText[index];
    const nextCharacter = sourceText[index + 1];
    if (character === undefined) continue;

    if (inQuotes) {
      if (character === "\"" && nextCharacter === "\"") {
        cell += "\"";
        index += 1;
      } else if (character === "\"") {
        inQuotes = false;
      } else {
        if (character === "\n") lineNumber += 1;
        cell += character;
      }
      continue;
    }

    if (character === "\"") inQuotes = true;
    else if (character === delimiter) pushCell();
    else if (character === "\n") {
      pushRow();
      lineNumber += 1;
      currentRowNumber = lineNumber;
    } else cell += character;
  }

  if (inQuotes) {
    warnings.push(sourceWarning(
      "malformed_row",
      `Row ${currentRowNumber} has an unterminated quoted field.`,
      currentRowNumber,
    ));
  }
  if (cell.length > 0 || cells.length > 0) pushRow();
  return { rows, warnings };
};

export const nonEmptyRows = (
  rows: readonly ParsedDelimitedRow[],
): ParsedDelimitedRow[] => rows.filter(row => row.cells.some(cell => cell.length > 0));
