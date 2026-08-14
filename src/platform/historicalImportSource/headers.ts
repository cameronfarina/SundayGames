import { cleanCell, normalizeHeader } from "./cells.js";
import { headerAliases, requiredColumns, sourceColumns } from "./constants.js";
import type {
  HeaderIndexResult,
  HistoricalImportSourceColumn,
  ParsedDelimitedRow,
} from "./contracts.js";
import { sourceWarning } from "./warnings.js";

export const columnForHeader = (
  header: string,
): HistoricalImportSourceColumn | null => {
  const normalizedHeader = normalizeHeader(header);
  for (const column of sourceColumns) {
    if (headerAliases[column].has(normalizedHeader)) return column;
  }
  return null;
};

export const headerIndexFor = (headerRow: ParsedDelimitedRow): HeaderIndexResult => {
  const headerMap = new Map<HistoricalImportSourceColumn, number>();
  const warnings = [];

  headerRow.cells.forEach((cell, index) => {
    const column = columnForHeader(cell);
    if (column === null) return;
    if (headerMap.has(column)) {
      warnings.push(sourceWarning(
        "duplicate_header",
        `Header "${cell}" duplicates the ${column} field; the first matching column will be used.`,
        headerRow.rowNumber,
        column,
      ));
      return;
    }
    headerMap.set(column, index);
  });

  for (const column of requiredColumns) {
    if (headerMap.has(column)) continue;
    warnings.push(sourceWarning(
      "required_header_missing",
      `Historical import source is missing a ${column} column.`,
      headerRow.rowNumber,
      column,
    ));
  }
  return { headerMap, warnings };
};

export const cellValue = (
  row: ParsedDelimitedRow,
  headerMap: ReadonlyMap<HistoricalImportSourceColumn, number>,
  column: HistoricalImportSourceColumn,
): string => {
  const index = headerMap.get(column);
  return index === undefined ? "" : cleanCell(row.cells[index]);
};
