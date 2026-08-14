import type { PlayerContextEvidence } from "../../../config/playerContext.js";

type CsvValue = string | number | boolean | undefined;

const csvCell = (value: CsvValue): string => {
  const text = value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
};

export const playerContextEvidenceCsv = (rows: readonly PlayerContextEvidence[]): string =>
  [
    "player,category,score,confidence,source,note,provider,source_date,source_quality",
    ...rows.map(row => [
      row.player, row.category, row.score, row.confidence, row.source, row.note,
      row.provider, row.sourceDate, row.sourceQuality,
    ].map(csvCell).join(",")),
  ].join("\n");
