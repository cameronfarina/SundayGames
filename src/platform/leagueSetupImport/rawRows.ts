import { hasUnquotedPipe, parseDelimitedLine } from "./delimitedLine.js";
import { createImportIssue } from "./importIssue.js";
import type { RawLeagueSetupRow } from "./internalTypes.js";

const rawRowFor = (line: string, index: number): RawLeagueSetupRow | null => {
  if (line.trim().length === 0) return null;

  const delimiter = hasUnquotedPipe(line) ? "|" : ",";
  const rowNumber = index + 1;

  try {
    return {
      rowNumber,
      cells: parseDelimitedLine(line, delimiter, rowNumber),
      blockers: [],
    };
  } catch {
    return {
      rowNumber,
      cells: [],
      blockers: [
        createImportIssue(
          "malformed_row",
          `Row ${rowNumber} has an unterminated quoted field.`,
          rowNumber,
        ),
      ],
    };
  }
};

export const parseRawRows = (content: string): RawLeagueSetupRow[] =>
  content
    .split(/\r\n|\n|\r/)
    .flatMap((line, index) => {
      const row = rawRowFor(line, index);
      return row === null ? [] : [row];
    });
