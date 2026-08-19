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
  | "invalid_position_rank"
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

export type SlotPriceSlotColumn = "slot" | "positionRank";

/**
 * Either one cell that names the slot outright ("RB1"), or a position column
 * beside a rank column. Both carry a price, and either may carry a season.
 */
export type SlotPriceHeaderIndex =
  | { price: number; slot: number; position?: undefined; positionRank?: undefined; seasonYear?: number }
  | { price: number; slot?: undefined; position: number; positionRank: number; seasonYear?: number };

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
