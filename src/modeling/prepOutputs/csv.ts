export type CsvValue = string | number | boolean | null | undefined;

const csvCell = (value: CsvValue): string => {
  const text = value === undefined || value === null ? "" : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll("\"", "\"\"")}"`;
};

export const toCsv = (
  headers: readonly string[],
  rows: readonly (readonly CsvValue[])[],
): string =>
  [
    headers.map(csvCell).join(","),
    ...rows.map(row => row.map(csvCell).join(",")),
  ].join("\n");

export const jsonArtifact = (value: unknown): string =>
  `${JSON.stringify(value, null, 2)}\n`;

export const csvArtifact = (content: string): string => `${content}\n`;
