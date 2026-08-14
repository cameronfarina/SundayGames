export const defaultHistoricalImportMaxActivePreviewBatches = 8;
export const defaultHistoricalImportPreviewTtlMs = 24 * 60 * 60 * 1_000;

export const previewRetentionValue = (
  value: number | undefined,
  fallback: number,
  name: string,
): number => {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved <= 0) {
    throw new RangeError(`${name} must be a positive safe integer.`);
  }
  return resolved;
};
