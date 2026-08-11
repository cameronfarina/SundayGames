import {
  parseHistoricalImportSource,
  type HistoricalImportSourceWarning,
} from "./historicalImportSource.js";
import {
  commitHistoricalImportBatch,
  previewHistoricalImportBatch,
  type HistoricalImportBatch,
  type HistoricalImportIssue,
  type HistoricalImportPlayerCatalogEntry,
  type HistoricalImportRepository,
  type HistoricalImportSeasonContext,
  type HistoricalOwnerMapping,
  type HistoricalSaleRecord,
  resolveHistoricalImportPlayers,
} from "./historicalImports.js";

export interface PreviewHistoricalImportSourceWorkflowInput {
  repository: HistoricalImportRepository;
  leagueId: string;
  seasonYear: number;
  seasonContext?: HistoricalImportSeasonContext;
  sourceText: string;
  uploadedByUserId?: string;
  replacementRequested?: boolean;
  playerCatalog?: readonly HistoricalImportPlayerCatalogEntry[];
  ownerMappings?: readonly HistoricalOwnerMapping[];
  playerMappings?: readonly HistoricalPlayerMapping[];
  now?: Date;
}

export interface HistoricalPlayerMapping {
  rowNumber: number;
  playerId: string;
}

export interface HistoricalImportSourceWorkflowSummary {
  fileHash: string;
  sourceRowCount: number;
  sourceWarnings: HistoricalImportSourceWarning[];
  playerResolutionIssues: HistoricalImportIssue[];
}

export interface PreviewHistoricalImportSourceWorkflowResult {
  source: HistoricalImportSourceWorkflowSummary;
  batch: HistoricalImportBatch;
}

export interface CommitHistoricalImportWorkflowInput {
  repository: HistoricalImportRepository;
  batchId: string;
  expectedLeagueId?: string;
  expectedLeagueSeasonId?: string;
  expectedSeasonYear?: number;
  now?: Date;
}

export interface CommitHistoricalImportWorkflowResult {
  batch: HistoricalImportBatch;
  committedRecords: HistoricalSaleRecord[];
}

const recordsFromBatchRows = (
  batch: HistoricalImportBatch,
): HistoricalSaleRecord[] =>
  batch.rows.flatMap(rowPreview =>
    rowPreview.record === null ? [] : [rowPreview.record],
  );

export const previewHistoricalImportSourceWorkflow = async ({
  repository,
  leagueId,
  seasonYear,
  seasonContext,
  sourceText,
  uploadedByUserId,
  replacementRequested,
  playerCatalog,
  ownerMappings,
  playerMappings,
  now,
}: PreviewHistoricalImportSourceWorkflowInput): Promise<PreviewHistoricalImportSourceWorkflowResult> => {
  const source = parseHistoricalImportSource(sourceText);
  const playerIdByRowNumber = new Map(
    (playerMappings ?? []).map(mapping => [mapping.rowNumber, mapping.playerId.trim()]),
  );
  const sourceRows = source.rows.map(row => {
    const playerId = playerIdByRowNumber.get(row.sourceRowNumber);
    return playerId === undefined || playerId.length === 0 ? row : { ...row, playerId };
  });
  const playerResolution = playerCatalog === undefined
    ? { rows: sourceRows, issues: [] }
    : resolveHistoricalImportPlayers({ rows: sourceRows, playerCatalog });
  const batch = await previewHistoricalImportBatch({
    repository,
    leagueId,
    seasonYear,
    ...(seasonContext === undefined ? {} : { seasonContext }),
    fileHash: source.fileHash,
    rows: playerResolution.rows,
    ...(uploadedByUserId === undefined ? {} : { uploadedByUserId }),
    ...(replacementRequested === undefined ? {} : { replacementRequested }),
    ...(ownerMappings === undefined ? {} : { ownerMappings }),
    ...(now === undefined ? {} : { now }),
  });

  return {
    source: {
      fileHash: source.fileHash,
      sourceRowCount: source.sourceRowCount,
      sourceWarnings: source.warnings,
      playerResolutionIssues: playerResolution.issues,
    },
    batch,
  };
};

export const commitHistoricalImportWorkflow = async ({
  repository,
  batchId,
  expectedLeagueId,
  expectedLeagueSeasonId,
  expectedSeasonYear,
  now,
}: CommitHistoricalImportWorkflowInput): Promise<CommitHistoricalImportWorkflowResult> => {
  const batch = await commitHistoricalImportBatch({
    repository,
    batchId,
    ...(expectedLeagueId === undefined ? {} : { expectedLeagueId }),
    ...(expectedLeagueSeasonId === undefined ? {} : { expectedLeagueSeasonId }),
    ...(expectedSeasonYear === undefined ? {} : { expectedSeasonYear }),
    ...(now === undefined ? {} : { now }),
  });

  return {
    batch,
    committedRecords: recordsFromBatchRows(batch),
  };
};
