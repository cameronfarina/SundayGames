export const defaultHistoricalImportMaxRows = 2_500;
export const defaultHistoricalImportMaxCells = 50_000;

export interface HistoricalImportDocumentLimits {
  maxRows?: number | undefined;
  maxCells?: number | undefined;
}

export interface ResolvedHistoricalImportDocumentLimits {
  maxRows: number;
  maxCells: number;
}

export class HistoricalImportDocumentLimitError extends Error {
  readonly code: "historical_import_document_too_large" = "historical_import_document_too_large";

  constructor(message: string) {
    super(message);
    this.name = "HistoricalImportDocumentLimitError";
  }
}

const positiveLimit = (value: number | undefined, fallback: number, name: string): number => {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved <= 0) {
    throw new RangeError(`${name} must be a positive safe integer.`);
  }

  return resolved;
};

export const resolveHistoricalImportDocumentLimits = (
  limits: HistoricalImportDocumentLimits = {},
): ResolvedHistoricalImportDocumentLimits => ({
  maxRows: positiveLimit(limits.maxRows, defaultHistoricalImportMaxRows, "maxRows"),
  maxCells: positiveLimit(limits.maxCells, defaultHistoricalImportMaxCells, "maxCells"),
});

export const assertHistoricalImportRowCount = (
  rowCount: number,
  limits: ResolvedHistoricalImportDocumentLimits,
): void => {
  if (rowCount > limits.maxRows) {
    throw new HistoricalImportDocumentLimitError(
      `Historical draft files may contain at most ${limits.maxRows} rows.`,
    );
  }
};

export const assertHistoricalImportCellCount = (
  cellCount: number,
  limits: ResolvedHistoricalImportDocumentLimits,
): void => {
  if (cellCount > limits.maxCells) {
    throw new HistoricalImportDocumentLimitError(
      `Historical draft files may contain at most ${limits.maxCells} cells.`,
    );
  }
};

export const assertHistoricalImportTableDimensions = (
  rows: readonly (readonly unknown[])[],
  options: HistoricalImportDocumentLimits = {},
): void => {
  const limits = resolveHistoricalImportDocumentLimits(options);
  assertHistoricalImportRowCount(rows.length, limits);
  let cellCount = 0;
  for (const row of rows) {
    cellCount += row.length;
    assertHistoricalImportCellCount(cellCount, limits);
  }
};
