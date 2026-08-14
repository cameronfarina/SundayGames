import type { DraftExportCell } from "./contracts.js";

const csvCell = (cell: DraftExportCell): string => {
  const value = typeof cell === "string" && /^\s*[=+\-@]/u.test(cell)
    ? `'${cell}`
    : String(cell);
  return /[",\n\r]/.test(value) ? `"${value.replaceAll("\"", "\"\"")}"` : value;
};

export const tableToCsv = (table: readonly (readonly DraftExportCell[])[]): string =>
  table.map(row => row.map(csvCell).join(",")).join("\n");
