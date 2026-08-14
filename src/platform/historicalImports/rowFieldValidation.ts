import type { Position } from "../../../config/league.js";
import type { HistoricalImportIssue } from "./issueContracts.js";
import { historicalImportIssue } from "./issues.js";
import type {
  HistoricalPlayerResolutionCandidate,
  NormalizedHistoricalImportRow,
} from "./playerContracts.js";

interface RowFieldValidationInput {
  row: NormalizedHistoricalImportRow;
  position: Position | null;
  playerName: string;
  playerId: string | null;
}

const unresolvedCandidates = (
  row: NormalizedHistoricalImportRow,
): HistoricalPlayerResolutionCandidate[] =>
  (row.playerResolution?.status === "unresolved"
    ? row.playerResolution.candidates ?? []
    : [])
    .filter((candidate): candidate is HistoricalPlayerResolutionCandidate =>
      typeof candidate !== "string"
    );

export const historicalImportRowFieldBlockers = ({
  row,
  position,
  playerName,
  playerId,
}: RowFieldValidationInput): HistoricalImportIssue[] => {
  const blockers: HistoricalImportIssue[] = [];
  if (position === null) {
    blockers.push(historicalImportIssue(
      "position_invalid",
      "blocker",
      "Position must be QB, RB, WR, TE, K, or DST.",
      row.sourceRowNumber,
    ));
  }
  if (playerName.length === 0) {
    blockers.push(historicalImportIssue(
      "player_missing",
      "blocker",
      "Player name is required.",
      row.sourceRowNumber,
    ));
  }
  if (row.priceDollars === undefined || !Number.isInteger(row.priceDollars) || row.priceDollars < 0) {
    blockers.push(historicalImportIssue(
      "price_invalid",
      "blocker",
      "Price must be a non-negative whole dollar amount.",
      row.sourceRowNumber,
    ));
  }
  if (
    row.publicPriceDollars !== undefined
    && (!Number.isInteger(row.publicPriceDollars) || row.publicPriceDollars <= 0)
  ) {
    blockers.push(historicalImportIssue(
      "public_price_invalid",
      "blocker",
      "Same-season public value must be a positive whole dollar amount.",
      row.sourceRowNumber,
    ));
  }
  if (row.playerResolution?.status === "ambiguous") {
    blockers.push(historicalImportIssue(
      "player_ambiguous",
      "blocker",
      "Multiple catalog players match this row. Choose the intended player before import.",
      row.sourceRowNumber,
      { sourceValue: playerName, candidates: row.playerResolution.candidates },
    ));
  }
  if (row.playerResolution?.status === "unresolved") {
    const candidates = unresolvedCandidates(row);
    blockers.push(historicalImportIssue(
      "player_unresolved",
      "blocker",
      "Player must be resolved before import commit.",
      row.sourceRowNumber,
      { sourceValue: playerName, ...(candidates.length === 0 ? {} : { candidates }) },
    ));
  }
  if (
    playerName.length > 0
    && playerId === null
    && !blockers.some(blocker =>
      blocker.code === "player_unresolved" || blocker.code === "player_ambiguous"
    )
  ) {
    blockers.push(historicalImportIssue(
      "player_unresolved",
      "blocker",
      "Player must be resolved before import commit.",
      row.sourceRowNumber,
    ));
  }
  return blockers;
};
