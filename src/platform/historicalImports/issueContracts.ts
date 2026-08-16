import type {
  HistoricalImportReviewCandidate,
  NormalizedHistoricalImportRow,
} from "./playerContracts.js";

export type HistoricalImportIssueSeverity = "blocker" | "warning";

export type HistoricalImportIssueCode =
  | "season_missing"
  | "team_count_mismatch"
  | "owner_unknown"
  | "owner_ambiguous"
  | "owner_mapping_not_one_to_one"
  | "owner_fuzzy_match"
  | "owner_unmapped"
  | "position_invalid"
  | "player_missing"
  | "price_invalid"
  | "public_price_invalid"
  | "player_duplicate"
  | "player_ambiguous"
  | "player_unresolved"
  | "player_historical_only"
  | "season_spend_mismatch"
  | "keeper_inferred"
  | "acquisition_type_inferred";

export interface HistoricalImportIssue {
  code: HistoricalImportIssueCode;
  severity: HistoricalImportIssueSeverity;
  message: string;
  rowNumber?: number;
  sourceValue?: string;
  candidates?: readonly HistoricalImportReviewCandidate[];
}

export interface ResolveHistoricalImportPlayersResult {
  rows: NormalizedHistoricalImportRow[];
  issues: HistoricalImportIssue[];
}
