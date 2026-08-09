import { createHash } from "node:crypto";
import type {
  HistoricalAcquisitionType,
  NormalizedHistoricalImportRow,
} from "./historicalImports.js";

type HistoricalImportSourceDelimiter = "," | "\t" | ";";

type HistoricalImportSourceColumn =
  | "owner"
  | "player"
  | "position"
  | "price"
  | "seasonYear"
  | "playerId"
  | "keeper"
  | "acquisitionType";

export type HistoricalImportSourceWarningCode =
  | "duplicate_header"
  | "invalid_acquisition_type"
  | "invalid_keeper"
  | "invalid_season_year"
  | "malformed_row"
  | "required_header_missing"
  | "source_empty";

export interface HistoricalImportSourceWarning {
  code: HistoricalImportSourceWarningCode;
  message: string;
  rowNumber?: number;
  column?: string;
}

export interface HistoricalImportSourceParseResult {
  rows: NormalizedHistoricalImportRow[];
  fileHash: string;
  sourceRowCount: number;
  warnings: HistoricalImportSourceWarning[];
}

interface ParsedDelimitedRow {
  rowNumber: number;
  cells: string[];
}

interface HeaderIndexResult {
  headerMap: Map<HistoricalImportSourceColumn, number>;
  warnings: HistoricalImportSourceWarning[];
}

interface DelimiterScore {
  delimiter: HistoricalImportSourceDelimiter;
  recognizedHeaderCount: number;
  requiredHeaderCount: number;
  cellCount: number;
}

const delimiters = [",", "\t", ";"] as const satisfies readonly HistoricalImportSourceDelimiter[];
const sourceColumns = [
  "owner",
  "player",
  "position",
  "price",
  "seasonYear",
  "playerId",
  "keeper",
  "acquisitionType",
] as const satisfies readonly HistoricalImportSourceColumn[];
const requiredColumns = ["owner", "player", "position", "price"] as const satisfies readonly HistoricalImportSourceColumn[];

const headerAliases: Record<HistoricalImportSourceColumn, ReadonlySet<string>> = {
  owner: new Set(["owner", "team", "ownername"]),
  player: new Set(["player", "playername", "name"]),
  position: new Set(["pos", "position"]),
  price: new Set(["price", "amount", "cost", "salary"]),
  seasonYear: new Set(["year", "season", "seasonyear"]),
  playerId: new Set(["playerid", "espnid"]),
  keeper: new Set(["keeper", "iskeeper"]),
  acquisitionType: new Set(["acquisition", "acquisitiontype", "type"]),
};

const truthyKeeperValues = new Set(["true", "yes", "y", "keeper", "1"]);
const falseyKeeperValues = new Set(["false", "no", "n", "auction", "0"]);
const integerCellPattern = /^-?\d+(?:\.0+)?$/u;

const normalizeSourceText = (sourceText: string): string => {
  const lines = sourceText
    .replace(/^\uFEFF/u, "")
    .replace(/\r\n/gu, "\n")
    .replace(/\r/gu, "\n")
    .split("\n")
    .map(line => line.replace(/[ \t]+$/u, ""));

  while (lines.length > 0 && (lines.at(-1) ?? "").trim().length === 0) {
    lines.pop();
  }

  return lines.join("\n");
};

const fileHashFor = (normalizedSourceText: string): string =>
  `sha256:${createHash("sha256").update(normalizedSourceText).digest("hex")}`;

const cleanCell = (value: string | undefined): string =>
  (value ?? "").replace(/\u00a0/gu, " ").trim();

const normalizeHeader = (value: string): string =>
  cleanCell(value).toLowerCase().replace(/[^a-z0-9]+/gu, "");

const columnForHeader = (header: string): HistoricalImportSourceColumn | null => {
  const normalizedHeader = normalizeHeader(header);

  for (const column of sourceColumns) {
    if (headerAliases[column].has(normalizedHeader)) return column;
  }

  return null;
};

const warning = (
  code: HistoricalImportSourceWarningCode,
  message: string,
  rowNumber?: number,
  column?: string,
): HistoricalImportSourceWarning => ({
  code,
  message,
  ...(rowNumber === undefined ? {} : { rowNumber }),
  ...(column === undefined ? {} : { column }),
});

const parseDelimitedRows = (
  sourceText: string,
  delimiter: HistoricalImportSourceDelimiter,
): { rows: ParsedDelimitedRow[]; warnings: HistoricalImportSourceWarning[] } => {
  const rows: ParsedDelimitedRow[] = [];
  const warnings: HistoricalImportSourceWarning[] = [];
  let cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  let lineNumber = 1;
  let currentRowNumber = 1;

  const pushCell = (): void => {
    cells.push(cleanCell(cell));
    cell = "";
  };

  const pushRow = (): void => {
    pushCell();
    rows.push({
      rowNumber: currentRowNumber,
      cells,
    });
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
        continue;
      }

      if (character === "\"") {
        inQuotes = false;
        continue;
      }

      if (character === "\n") {
        lineNumber += 1;
      }

      cell += character;
      continue;
    }

    if (character === "\"") {
      inQuotes = true;
      continue;
    }

    if (character === delimiter) {
      pushCell();
      continue;
    }

    if (character === "\n") {
      pushRow();
      lineNumber += 1;
      currentRowNumber = lineNumber;
      continue;
    }

    cell += character;
  }

  if (inQuotes) {
    warnings.push(warning(
      "malformed_row",
      `Row ${currentRowNumber} has an unterminated quoted field.`,
      currentRowNumber,
    ));
  }

  if (cell.length > 0 || cells.length > 0) {
    pushRow();
  }

  return { rows, warnings };
};

const nonEmptyRows = (rows: readonly ParsedDelimitedRow[]): ParsedDelimitedRow[] =>
  rows.filter(row => row.cells.some(cell => cell.length > 0));

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

const detectDelimiter = (headerRow: ParsedDelimitedRow): HistoricalImportSourceDelimiter => {
  const headerLine = headerRow.cells.join(",");
  const scores = delimiters.map(delimiter => delimiterScoreFor(headerLine, delimiter));

  return scores.sort((left, right) =>
    right.requiredHeaderCount - left.requiredHeaderCount
      || right.recognizedHeaderCount - left.recognizedHeaderCount
      || right.cellCount - left.cellCount
      || delimiters.indexOf(left.delimiter) - delimiters.indexOf(right.delimiter)
  )[0]?.delimiter ?? ",";
};

const headerIndexFor = (headerRow: ParsedDelimitedRow): HeaderIndexResult => {
  const headerMap = new Map<HistoricalImportSourceColumn, number>();
  const warnings: HistoricalImportSourceWarning[] = [];

  headerRow.cells.forEach((cell, index) => {
    const column = columnForHeader(cell);
    if (column === null) return;

    if (headerMap.has(column)) {
      warnings.push(warning(
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

    warnings.push(warning(
      "required_header_missing",
      `Historical import source is missing a ${column} column.`,
      headerRow.rowNumber,
      column,
    ));
  }

  return { headerMap, warnings };
};

const cellValue = (
  row: ParsedDelimitedRow,
  headerMap: ReadonlyMap<HistoricalImportSourceColumn, number>,
  column: HistoricalImportSourceColumn,
): string => {
  const index = headerMap.get(column);

  return index === undefined ? "" : cleanCell(row.cells[index]);
};

const parseIntegerCell = (value: string): number | undefined => {
  const cleaned = cleanCell(value);
  if (cleaned.length === 0) return undefined;
  if (!integerCellPattern.test(cleaned)) return undefined;

  const parsed = Number(cleaned);

  return Number.isSafeInteger(parsed) ? parsed : undefined;
};

const parsePriceDollars = (value: string): number | undefined =>
  parseIntegerCell(cleanCell(value).replace(/\$/gu, "").replace(/,/gu, ""));

const parseKeeper = (value: string): boolean | undefined => {
  const normalizedValue = cleanCell(value).toLowerCase();

  if (normalizedValue.length === 0) return undefined;
  if (truthyKeeperValues.has(normalizedValue)) return true;
  if (falseyKeeperValues.has(normalizedValue)) return false;

  return undefined;
};

const parseAcquisitionType = (value: string): HistoricalAcquisitionType | undefined => {
  const normalizedValue = cleanCell(value).toLowerCase();

  if (normalizedValue === "auction" || normalizedValue === "keeper") {
    return normalizedValue;
  }

  return undefined;
};

const rowFor = (
  row: ParsedDelimitedRow,
  headerMap: ReadonlyMap<HistoricalImportSourceColumn, number>,
  warnings: HistoricalImportSourceWarning[],
): NormalizedHistoricalImportRow => {
  const sourceRow: NormalizedHistoricalImportRow = {
    sourceRowNumber: row.rowNumber,
  };
  const ownerDisplayName = cellValue(row, headerMap, "owner");
  const playerName = cellValue(row, headerMap, "player");
  const playerId = cellValue(row, headerMap, "playerId");
  const position = cellValue(row, headerMap, "position");
  const priceDollars = parsePriceDollars(cellValue(row, headerMap, "price"));
  const seasonYearValue = cellValue(row, headerMap, "seasonYear");
  const seasonYear = parseIntegerCell(seasonYearValue);
  const keeperValue = cellValue(row, headerMap, "keeper");
  const keeper = parseKeeper(keeperValue);
  const acquisitionTypeValue = cellValue(row, headerMap, "acquisitionType");
  const acquisitionType = parseAcquisitionType(acquisitionTypeValue);

  if (ownerDisplayName.length > 0) sourceRow.ownerDisplayName = ownerDisplayName;
  if (playerName.length > 0) sourceRow.playerName = playerName;
  if (playerId.length > 0) sourceRow.playerId = playerId;
  if (position.length > 0) sourceRow.position = position;
  if (priceDollars !== undefined) sourceRow.priceDollars = priceDollars;
  if (seasonYear !== undefined) sourceRow.seasonYear = seasonYear;
  if (keeper !== undefined) sourceRow.keeper = keeper;
  if (acquisitionType !== undefined) sourceRow.acquisitionType = acquisitionType;

  if (seasonYearValue.length > 0 && seasonYear === undefined) {
    warnings.push(warning(
      "invalid_season_year",
      `Row ${row.rowNumber} has an invalid season year "${seasonYearValue}".`,
      row.rowNumber,
      "seasonYear",
    ));
  }

  if (keeperValue.length > 0 && keeper === undefined) {
    warnings.push(warning(
      "invalid_keeper",
      `Row ${row.rowNumber} has an unrecognized keeper value "${keeperValue}".`,
      row.rowNumber,
      "keeper",
    ));
  }

  if (acquisitionTypeValue.length > 0 && acquisitionType === undefined) {
    warnings.push(warning(
      "invalid_acquisition_type",
      `Row ${row.rowNumber} has an unrecognized acquisition type "${acquisitionTypeValue}".`,
      row.rowNumber,
      "acquisitionType",
    ));
  }

  return sourceRow;
};

export const parseHistoricalImportSource = (
  sourceText: string,
): HistoricalImportSourceParseResult => {
  const normalizedSourceText = normalizeSourceText(sourceText);
  const fileHash = fileHashFor(normalizedSourceText);
  const initiallyParsedRows = nonEmptyRows(parseDelimitedRows(normalizedSourceText, ",").rows);
  const headerRow = initiallyParsedRows[0];

  if (headerRow === undefined) {
    return {
      rows: [],
      fileHash,
      sourceRowCount: 0,
      warnings: [warning("source_empty", "Historical import source is empty.")],
    };
  }

  const delimiter = detectDelimiter(headerRow);
  const parsedSource = parseDelimitedRows(normalizedSourceText, delimiter);
  const sourceRows = nonEmptyRows(parsedSource.rows);
  const mappedHeaderRow = sourceRows[0];

  if (mappedHeaderRow === undefined) {
    return {
      rows: [],
      fileHash,
      sourceRowCount: 0,
      warnings: [warning("source_empty", "Historical import source is empty.")],
    };
  }

  const headerIndex = headerIndexFor(mappedHeaderRow);
  const warnings = [
    ...parsedSource.warnings,
    ...headerIndex.warnings,
  ];
  const rows = sourceRows
    .slice(1)
    .map(row => rowFor(row, headerIndex.headerMap, warnings));

  return {
    rows,
    fileHash,
    sourceRowCount: sourceRows.length,
    warnings,
  };
};
