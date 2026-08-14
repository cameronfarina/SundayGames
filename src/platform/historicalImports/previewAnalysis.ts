import type { LeagueSeason } from "../leagueSeason.js";
import type {
  HistoricalImportRowPreview,
  HistoricalOwnerMapping,
} from "./batchContracts.js";
import { normalizeIdentityLabel } from "./identityNormalizer.js";
import { historicalImportIssue } from "./issues.js";
import type { NormalizedHistoricalImportRow } from "./playerContracts.js";
import { historicalImportRowPreview } from "./rowPreview.js";

export const distinctHistoricalTeamsFor = (
  rows: readonly NormalizedHistoricalImportRow[],
): Map<string, string> => {
  const distinctTeams = new Map<string, string>();
  for (const row of rows) {
    const sourceLabel = row.ownerDisplayName?.trim() ?? "";
    const normalizedLabel = normalizeIdentityLabel(sourceLabel);
    if (normalizedLabel.length > 0 && !distinctTeams.has(normalizedLabel)) {
      distinctTeams.set(normalizedLabel, sourceLabel);
    }
  }
  return distinctTeams;
};

const playerKeyFor = (row: HistoricalImportRowPreview): string | null => {
  if (row.record === null) return null;
  return row.record.playerId.length > 0
    ? `id:${row.record.playerId}`
    : `name:${row.record.playerName.trim().toLowerCase()}`;
};

const blockDuplicatePlayers = (
  rows: readonly HistoricalImportRowPreview[],
): HistoricalImportRowPreview[] => {
  const counts = rows.reduce<Map<string, number>>((result, row) => {
    const key = playerKeyFor(row);
    if (key !== null) result.set(key, (result.get(key) ?? 0) + 1);
    return result;
  }, new Map<string, number>());

  return rows.map(row => {
    const key = playerKeyFor(row);
    if (key === null || (counts.get(key) ?? 0) < 2) return row;
    return {
      ...row,
      status: "blocked",
      blockers: [
        ...row.blockers,
        historicalImportIssue(
          "player_duplicate",
          "blocker",
          "Player appears more than once in this league season import.",
          row.rowNumber,
        ),
      ],
      record: null,
    };
  });
};

interface PreviewRowsInput {
  rows: readonly NormalizedHistoricalImportRow[];
  batchId: string;
  leagueId: string;
  seasonYear: number;
  season: LeagueSeason;
  ownerMappings: readonly HistoricalOwnerMapping[];
}

export const analyzedRowPreviews = ({
  rows,
  batchId,
  leagueId,
  seasonYear,
  season,
  ownerMappings,
}: PreviewRowsInput): HistoricalImportRowPreview[] => blockDuplicatePlayers(
  rows.map((row, index) => historicalImportRowPreview({
    row,
    index,
    batchId,
    leagueId,
    seasonYear,
    season,
    ownerMappings,
  })),
);

export const ownerMappingBlockers = (
  rows: readonly HistoricalImportRowPreview[],
  distinctHistoricalTeamCount: number,
  requireCompleteTeamMapping: boolean,
) => {
  const teamsByHistoricalLabel = new Map<string, string>();
  for (const row of rows) {
    const normalizedLabel = normalizeIdentityLabel(row.identityAudit?.sourceOwnerOrTeamLabel);
    const mappedTeamId = row.identityAudit?.mappedTeamId;
    if (normalizedLabel.length > 0 && mappedTeamId !== undefined) {
      teamsByHistoricalLabel.set(normalizedLabel, mappedTeamId);
    }
  }
  const mappedTeamIds = [...teamsByHistoricalLabel.values()];
  const isInvalid = requireCompleteTeamMapping
    && teamsByHistoricalLabel.size === distinctHistoricalTeamCount
    && new Set(mappedTeamIds).size !== mappedTeamIds.length;
  return isInvalid
    ? [historicalImportIssue(
        "owner_mapping_not_one_to_one",
        "blocker",
        "Each historical team must map to a different current team.",
      )]
    : [];
};

export const spendWarnings = (
  rows: readonly HistoricalImportRowPreview[],
  season: LeagueSeason,
) => {
  const actualSpend = rows.reduce(
    (total, row) => total + (row.record?.priceDollars ?? 0),
    0,
  );
  const auctionBudget = season.settings.draftFormat === "snake"
    ? null
    : season.settings.auction.budgetDollars;
  const expectedSpend = auctionBudget === null
    ? null
    : season.teams.length * auctionBudget;
  return expectedSpend === null || actualSpend === expectedSpend
    ? []
    : [historicalImportIssue(
        "season_spend_mismatch",
        "warning",
        `Imported spend is $${actualSpend}, expected $${expectedSpend}.`,
      )];
};
