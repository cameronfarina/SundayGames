export interface SlotPriceSeasonSheet {
  readonly seasonYear: number;
  readonly sourceText: string;
}

const DELIMITERS: readonly string[] = [",", "\t", ";"];

const delimiterFor = (headerLine: string): string => {
  const counts = DELIMITERS.map(delimiter => ({
    delimiter,
    count: headerLine.split(delimiter).length - 1,
  }));
  const best = counts.reduce((winner, candidate) =>
    candidate.count > winner.count ? candidate : winner);
  return best.count === 0 ? "," : best.delimiter;
};

const seasonYearIn = (value: string): number | undefined => {
  const cleaned = value.trim();
  if (!/^\d{4}$/u.test(cleaned)) return undefined;
  const year = Number(cleaned);
  return year >= 2000 && year <= 2100 ? year : undefined;
};

const isSeasonHeader = (value: string): boolean =>
  ["year", "season", "seasonyear", "draftyear"]
    .includes(value.trim().toLowerCase().replace(/[^a-z0-9]+/gu, ""));

const nonEmptyLines = (sourceText: string): string[] =>
  sourceText.split(/\r?\n/u).filter(line => line.trim().length > 0);

const sheet = (
  seasonYear: number,
  headerCells: readonly string[],
  rows: readonly string[],
  delimiter: string,
): SlotPriceSeasonSheet => ({
  seasonYear,
  sourceText: [headerCells.join(delimiter), ...rows].join("\n"),
});

/**
 * One column of prices per draft year. Each year becomes its own sheet, because
 * a historical import batch covers exactly one year and replacing a year is how
 * a correction is made.
 */
const sheetsFromYearColumns = (
  headerCells: readonly string[],
  bodyLines: readonly string[],
  delimiter: string,
): SlotPriceSeasonSheet[] => {
  const labelColumns = headerCells.flatMap((cell, index) =>
    seasonYearIn(cell) === undefined ? [{ header: cell, index }] : []);
  const labelHeaders = labelColumns.map(column => column.header);
  return headerCells.flatMap((cell, priceIndex) => {
    const seasonYear = seasonYearIn(cell);
    if (seasonYear === undefined) return [];
    const rows = bodyLines.flatMap(line => {
      const cells = line.split(delimiter);
      const price = (cells[priceIndex] ?? "").trim();
      if (price.length === 0) return [];
      const labels = labelColumns.map(column => (cells[column.index] ?? "").trim());
      return [[...labels, price, String(seasonYear)].join(delimiter)];
    });
    return rows.length === 0
      ? []
      : [sheet(seasonYear, [...labelHeaders, "Price", "Season"], rows, delimiter)];
  });
};

/** One row per slot per year, with the year in its own column. */
const sheetsFromSeasonColumn = (
  headerCells: readonly string[],
  bodyLines: readonly string[],
  delimiter: string,
  seasonIndex: number,
): SlotPriceSeasonSheet[] => {
  const linesByYear = new Map<number, string[]>();
  for (const line of bodyLines) {
    const seasonYear = seasonYearIn(line.split(delimiter)[seasonIndex] ?? "");
    if (seasonYear === undefined) continue;
    linesByYear.set(seasonYear, [...linesByYear.get(seasonYear) ?? [], line]);
  }
  return [...linesByYear.entries()]
    .sort(([left], [right]) => right - left)
    .map(([seasonYear, rows]) => sheet(seasonYear, headerCells, rows, delimiter));
};

/**
 * Splits one pasted block of slot prices into a sheet per draft year, leaving
 * every cell exactly as it was typed. Reading what a slot or a price means is
 * the server's job; this only decides which rows belong to which year.
 */
export const slotPriceSeasonSheets = (
  sourceText: string,
  fallbackSeasonYear: number,
): readonly SlotPriceSeasonSheet[] => {
  const lines = nonEmptyLines(sourceText);
  const headerLine = lines[0];
  if (headerLine === undefined) return [];
  const wholeSheet = [{ seasonYear: fallbackSeasonYear, sourceText: lines.join("\n") }];
  // A quoted cell can hide the delimiter, and splitting one apart would corrupt
  // the paste. The server parses quoting properly, so hand it the block whole.
  if (sourceText.includes("\"")) return wholeSheet;

  const delimiter = delimiterFor(headerLine);
  const headerCells = headerLine.split(delimiter);
  const bodyLines = lines.slice(1);
  if (bodyLines.length === 0) return wholeSheet;

  const yearColumnSheets = sheetsFromYearColumns(headerCells, bodyLines, delimiter);
  if (yearColumnSheets.length > 0) return yearColumnSheets;

  const seasonIndex = headerCells.findIndex(isSeasonHeader);
  if (seasonIndex < 0) return wholeSheet;
  const seasonSheets = sheetsFromSeasonColumn(headerCells, bodyLines, delimiter, seasonIndex);
  return seasonSheets.length > 0 ? seasonSheets : wholeSheet;
};
