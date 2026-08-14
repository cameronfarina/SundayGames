import type { LeagueSeason } from "../leagueSeason.js";
import type {
  HistoricalImportRowPreview,
  HistoricalOwnerMapping,
} from "./batchContracts.js";
import { playerIdFromRow } from "./ids.js";
import { teamResolutionForOwner } from "./ownerResolution.js";
import type { NormalizedHistoricalImportRow } from "./playerContracts.js";
import { resolveHistoricalPosition } from "./position.js";
import { validateHistoricalImportRow } from "./rowValidation.js";

interface RowPreviewInput {
  row: NormalizedHistoricalImportRow;
  index: number;
  batchId: string;
  leagueId: string;
  seasonYear: number;
  season: LeagueSeason;
  ownerMappings: readonly HistoricalOwnerMapping[];
}

export const historicalImportRowPreview = ({
  row,
  index,
  batchId,
  leagueId,
  seasonYear,
  season,
  ownerMappings,
}: RowPreviewInput): HistoricalImportRowPreview => {
  const teamResolution = teamResolutionForOwner(row.ownerDisplayName, season.teams, ownerMappings);
  const team = teamResolution.team;
  const position = resolveHistoricalPosition(row.position);
  const playerName = row.playerName?.trim() ?? "";
  const playerId = playerIdFromRow(row);
  const keeper = row.keeper ?? false;
  const acquisitionType = row.acquisitionType ?? (keeper ? "keeper" : "auction");
  const { blockers, warnings } = validateHistoricalImportRow({
    row,
    seasonYear,
    teamResolution,
    position,
    playerName,
    playerId,
    acquisitionType,
  });

  if (
    blockers.length > 0
    || team === null
    || position === null
    || playerName.length === 0
    || playerId === null
    || row.priceDollars === undefined
  ) {
    return {
      rowNumber: row.sourceRowNumber,
      status: "blocked",
      blockers,
      warnings,
      record: null,
      identityAudit: teamResolution.audit,
    };
  }

  return {
    rowNumber: row.sourceRowNumber,
    status: "ready",
    blockers,
    warnings,
    identityAudit: teamResolution.audit,
    record: {
      id: `${batchId}-row-${String(index + 1).padStart(3, "0")}`,
      batchId,
      leagueId,
      leagueSeasonId: season.id,
      seasonYear,
      rowNumber: row.sourceRowNumber,
      ownerId: team.ownerId,
      ownerDisplayName: teamResolution.audit.sourceOwnerOrTeamLabel,
      playerId,
      playerName,
      position,
      priceDollars: row.priceDollars,
      ...(row.publicPriceDollars === undefined
        ? {}
        : { publicPriceDollars: row.publicPriceDollars }),
      keeper,
      acquisitionType,
    },
  };
};
