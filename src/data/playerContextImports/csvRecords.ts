import type { CsvRow } from "./contracts.js";

const parseCsvRows = (content: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const nextCharacter = content[index + 1];
    if (character === "\"" && inQuotes && nextCharacter === "\"") {
      cell += "\"";
      index += 1;
    } else if (character === "\"") {
      inQuotes = !inQuotes;
    } else if (character === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      row.push(cell);
      if (row.some(value => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (inQuotes) throw new Error("Unterminated quoted field in player context CSV.");
  row.push(cell);
  if (row.some(value => value.trim() !== "")) rows.push(row);
  return rows;
};

export const parseCsvRecords = (content: string): CsvRow[] => {
  const rows = parseCsvRows(content);
  const headers = rows[0]?.map(header => header.trim());
  if (!headers || headers.length === 0) return [];
  return rows.slice(1).map(row =>
    Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""])),
  );
};
