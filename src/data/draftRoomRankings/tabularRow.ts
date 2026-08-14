const trimmedCells = (line: string): string[] => {
  const cells = line.split("\t").map(cell => cell.trim());
  while (cells[0] === "") cells.shift();
  return cells;
};

const numericValue = (value: string | undefined): number | undefined => {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const rowValue = (
  row: ReadonlyMap<string, string>,
  ...headers: readonly string[]
): string | undefined => {
  for (const header of headers) {
    const value = row.get(header);
    if (value !== undefined) return value;
  }
  return undefined;
};

export const rowNumber = (
  row: ReadonlyMap<string, string>,
  ...headers: readonly string[]
): number | undefined => numericValue(rowValue(row, ...headers));

export const tabularHeaders = (line: string): readonly string[] =>
  trimmedCells(line);

export const tabularRowFor = (
  headers: readonly string[],
  line: string,
): ReadonlyMap<string, string> => {
  const values = trimmedCells(line);
  return new Map(headers.map((header, index) => [header, values[index] ?? ""]));
};
