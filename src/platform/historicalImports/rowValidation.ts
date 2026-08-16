import type { Position } from "../../../config/league.js";
import type { HistoricalImportIssue } from "./issueContracts.js";
import { historicalImportIssue } from "./issues.js";
import type { HistoricalOwnerResolution } from "./ownerResolution.js";
import type { NormalizedHistoricalImportRow } from "./playerContracts.js";
import { historicalImportRowFieldBlockers } from "./rowFieldValidation.js";
import type { HistoricalAcquisitionType } from "./saleContracts.js";

interface RowValidationInput {
  row: NormalizedHistoricalImportRow;
  seasonYear: number;
  teamResolution: HistoricalOwnerResolution;
  position: Position | null;
  playerName: string;
  playerId: string | null;
  acquisitionType: HistoricalAcquisitionType;
  allowUnmappedOwner: boolean;
}

export interface HistoricalImportRowValidation {
  blockers: HistoricalImportIssue[];
  warnings: HistoricalImportIssue[];
}

export const validateHistoricalImportRow = ({
  row,
  seasonYear,
  teamResolution,
  position,
  playerName,
  playerId,
  acquisitionType,
  allowUnmappedOwner,
}: RowValidationInput): HistoricalImportRowValidation => {
  const blockers: HistoricalImportIssue[] = [];
  const warnings: HistoricalImportIssue[] = [];
  if (row.keeper === undefined) {
    warnings.push(historicalImportIssue(
      "keeper_inferred",
      "warning",
      "Keeper status was inferred as false.",
      row.sourceRowNumber,
    ));
  }
  if (row.acquisitionType === undefined) {
    warnings.push(historicalImportIssue(
      "acquisition_type_inferred",
      "warning",
      `Acquisition type was inferred as ${acquisitionType}.`,
      row.sourceRowNumber,
    ));
  }
  if (teamResolution.audit.resolution === "fuzzy" && teamResolution.team !== null) {
    warnings.push(historicalImportIssue(
      "owner_fuzzy_match",
      "warning",
      `Matched historical owner or team label "${teamResolution.audit.sourceOwnerOrTeamLabel}" to current team "${teamResolution.team.displayName}".`,
      row.sourceRowNumber,
      { sourceValue: teamResolution.audit.sourceOwnerOrTeamLabel },
    ));
  }
  if (row.seasonYear !== undefined && row.seasonYear !== seasonYear) {
    blockers.push(historicalImportIssue(
      "season_missing",
      "blocker",
      `Row season ${row.seasonYear} does not match import season ${seasonYear}.`,
      row.sourceRowNumber,
    ));
  }
  const unmappedHistoricalOwner = allowUnmappedOwner
    && teamResolution.audit.resolution === "unresolved"
    && teamResolution.audit.sourceOwnerOrTeamLabel.length > 0;
  if (unmappedHistoricalOwner) {
    warnings.push(historicalImportIssue(
      "owner_unmapped",
      "warning",
      "Historical owner is no longer in the current league and was retained for pricing history.",
      row.sourceRowNumber,
      { sourceValue: teamResolution.audit.sourceOwnerOrTeamLabel },
    ));
  } else if (teamResolution.team === null) {
    const code = teamResolution.audit.resolution === "ambiguous"
      ? "owner_ambiguous"
      : "owner_unknown";
    blockers.push(historicalImportIssue(
      code,
      "blocker",
      code === "owner_ambiguous"
        ? "Owner or team label matches multiple current teams. Choose the intended team."
        : "Owner or team label needs an explicit mapping to a current team.",
      row.sourceRowNumber,
      {
        sourceValue: teamResolution.audit.sourceOwnerOrTeamLabel,
        ...(teamResolution.audit.candidates === undefined
          ? {}
          : { candidates: teamResolution.audit.candidates }),
      },
    ));
  }
  blockers.push(...historicalImportRowFieldBlockers({ row, position, playerName, playerId }));
  return { blockers, warnings };
};
