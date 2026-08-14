import type {
  LeagueMembersScreenshotImportIssue,
  LeagueMembersScreenshotImportIssueCode,
} from "./types.js";

export const normalizedKey = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

export const issue = (
  code: LeagueMembersScreenshotImportIssueCode,
  message: string,
  rowNumber?: number,
): LeagueMembersScreenshotImportIssue => ({
  code,
  severity: "blocker",
  message,
  ...(rowNumber === undefined ? {} : { rowNumber }),
});

export const duplicateIndexes = (values: readonly string[]): ReadonlySet<number> => {
  const indexesByValue = new Map<string, number[]>();
  values.forEach((value, index) => {
    const key = normalizedKey(value);
    if (key.length === 0) return;
    indexesByValue.set(key, [...(indexesByValue.get(key) ?? []), index]);
  });
  return new Set(
    [...indexesByValue.values()].filter(indexes => indexes.length > 1).flat(),
  );
};
