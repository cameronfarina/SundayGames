import type { PlayerEvidenceQueue } from "./contracts.js";

type CsvValue = string | number | boolean | undefined;

const csvCell = (value: CsvValue): string => {
  const text = value === undefined ? "" : String(value);
  return /[",\n;]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
};

const csvJoin = (values: readonly string[]): string => values.join("; ");

const headers = [
  "priority", "rank", "player", "position", "scenario_price", "average_mock_sale_price",
  "sale_vs_scenario_price", "current_evidence_count", "evidence_status", "flags", "categories",
  "research_prompts",
];

export const playerEvidenceQueueCsv = (queue: PlayerEvidenceQueue): string =>
  [
    headers.map(csvCell).join(","),
    ...queue.rows.map(row => [
      row.priority, row.rank, row.player, row.position, row.scenarioPrice,
      row.averageMockSalePrice, row.saleVsScenarioPrice, row.currentEvidenceCount,
      row.evidenceStatus, csvJoin(row.flags), csvJoin(row.categories), csvJoin(row.researchPrompts),
    ].map(csvCell).join(",")),
  ].join("\n");
