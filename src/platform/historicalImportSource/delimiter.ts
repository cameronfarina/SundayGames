import { delimiters, requiredColumns } from "./constants.js";
import type {
  DelimiterScore,
  HistoricalImportSourceColumn,
  HistoricalImportSourceDelimiter,
  ParsedDelimitedRow,
} from "./contracts.js";
import { parseDelimitedRows } from "./delimitedRows.js";
import { columnForHeader } from "./headers.js";

const delimiterScoreFor = (
  headerLine: string,
  delimiter: HistoricalImportSourceDelimiter,
): DelimiterScore => {
  const cells = parseDelimitedRows(headerLine, delimiter).rows[0]?.cells ?? [];
  const recognizedColumns = new Set<HistoricalImportSourceColumn>();
  for (const cell of cells) {
    const column = columnForHeader(cell);
    if (column !== null) recognizedColumns.add(column);
  }
  return {
    delimiter,
    recognizedHeaderCount: recognizedColumns.size,
    requiredHeaderCount: requiredColumns.filter(column => recognizedColumns.has(column)).length,
    cellCount: cells.length,
  };
};

const compareDelimiterScores = (left: DelimiterScore, right: DelimiterScore): number =>
  right.requiredHeaderCount - left.requiredHeaderCount
  || right.recognizedHeaderCount - left.recognizedHeaderCount
  || right.cellCount - left.cellCount
  || delimiters.indexOf(left.delimiter) - delimiters.indexOf(right.delimiter);

export const detectDelimiter = (
  headerRow: ParsedDelimitedRow,
): HistoricalImportSourceDelimiter => {
  const scores = delimiters
    .map(delimiter => delimiterScoreFor(headerRow.cells.join(","), delimiter))
    .sort(compareDelimiterScores);
  return scores[0]?.delimiter ?? ",";
};
