import {
  parseHistoricalImportSource,
  type HistoricalImportSourceWarning,
} from "./historicalImportSource.js";
import {
  commitHistoricalImportBatch,
  previewHistoricalImportBatch,
  type HistoricalImportBatch,
  type HistoricalImportRepository,
  type HistoricalSaleRecord,
} from "./historicalImports.js";

export interface PreviewHistoricalImportSourceWorkflowInput {
  repository: HistoricalImportRepository;
  leagueId: string;
  seasonYear: number;
  sourceText: string;
  replacementRequested?: boolean;
  now?: Date;
}

export interface HistoricalImportSourceWorkflowSummary {
  fileHash: string;
  sourceRowCount: number;
  sourceWarnings: HistoricalImportSourceWarning[];
}

export interface PreviewHistoricalImportSourceWorkflowResult {
  source: HistoricalImportSourceWorkflowSummary;
  batch: HistoricalImportBatch;
}

export interface CommitHistoricalImportWorkflowInput {
  repository: HistoricalImportRepository;
  batchId: string;
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

export const previewHistoricalImportSourceWorkflow = ({
  repository,
  leagueId,
  seasonYear,
  sourceText,
  replacementRequested,
  now,
}: PreviewHistoricalImportSourceWorkflowInput): PreviewHistoricalImportSourceWorkflowResult => {
  const source = parseHistoricalImportSource(sourceText);
  const batch = previewHistoricalImportBatch({
    repository,
    leagueId,
    seasonYear,
    fileHash: source.fileHash,
    rows: source.rows,
    ...(replacementRequested === undefined ? {} : { replacementRequested }),
    ...(now === undefined ? {} : { now }),
  });

  return {
    source: {
      fileHash: source.fileHash,
      sourceRowCount: source.sourceRowCount,
      sourceWarnings: source.warnings,
    },
    batch,
  };
};

export const commitHistoricalImportWorkflow = ({
  repository,
  batchId,
  now,
}: CommitHistoricalImportWorkflowInput): CommitHistoricalImportWorkflowResult => {
  const batch = commitHistoricalImportBatch({
    repository,
    batchId,
    ...(now === undefined ? {} : { now }),
  });

  return {
    batch,
    committedRecords: recordsFromBatchRows(batch),
  };
};
