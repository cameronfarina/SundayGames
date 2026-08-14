import type { NormalizedHistoricalImportRow } from "../historicalImports.js";
import type {
  HistoricalImportDocumentLimits,
  ResolvedHistoricalImportDocumentLimits,
} from "../historicalImportLimits.js";

export type HistoricalImportSourceDelimiter = "," | "\t" | ";";

export type HistoricalImportSourceColumn =
  | "owner"
  | "player"
  | "position"
  | "price"
  | "publicPrice"
  | "seasonYear"
  | "playerId"
  | "keeper"
  | "acquisitionType";

export type HistoricalImportSourceWarningCode =
  | "duplicate_header"
  | "invalid_acquisition_type"
  | "invalid_keeper"
  | "invalid_public_price"
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

export interface HistoricalImportSourceOptions extends HistoricalImportDocumentLimits {
  inferFirstRosterRowAsKeeper?: boolean;
}

export interface ParsedDelimitedRow {
  rowNumber: number;
  cells: string[];
}

export interface HeaderIndexResult {
  headerMap: Map<HistoricalImportSourceColumn, number>;
  warnings: HistoricalImportSourceWarning[];
}

export interface DelimiterScore {
  delimiter: HistoricalImportSourceDelimiter;
  recognizedHeaderCount: number;
  requiredHeaderCount: number;
  cellCount: number;
}

export interface WideAuctionOwnerBlock {
  ownerDisplayName: string;
  priceColumnIndex: number;
}

export interface ParsedDelimitedSource {
  rows: ParsedDelimitedRow[];
  warnings: HistoricalImportSourceWarning[];
}

export type DelimitedParser = (
  sourceText: string,
  delimiter: HistoricalImportSourceDelimiter,
  limits?: ResolvedHistoricalImportDocumentLimits,
) => ParsedDelimitedSource;
