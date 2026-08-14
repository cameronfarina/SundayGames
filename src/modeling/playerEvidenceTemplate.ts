import type {
  PlayerEvidenceQueue,
  PlayerEvidenceQueueRow,
} from "./playerEvidenceQueue.js";

type CsvValue = string | number | boolean | undefined;

const headers: readonly string[] = [
  "player",
  "category",
  "score",
  "confidence",
  "source",
  "note",
  "provider",
  "source_date",
  "source_quality",
  "priority",
  "rank",
  "position",
  "scenario_price",
  "average_mock_sale_price",
  "sale_vs_scenario_price",
  "evidence_status",
  "flags",
  "research_prompt",
];

const csvCell = (value: CsvValue): string => {
  const text = value === undefined ? "" : String(value);
  if (!/[",\n;]/.test(text)) return text;
  return `"${text.replaceAll("\"", "\"\"")}"`;
};

const csvJoin = (values: readonly string[]): string => values.join("; ");

const templateRowsFor = (
  row: PlayerEvidenceQueueRow,
): CsvValue[][] =>
  row.categories.map((category, index) => [
    row.player,
    category,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    row.priority,
    row.rank,
    row.position,
    row.scenarioPrice,
    row.averageMockSalePrice,
    row.saleVsScenarioPrice,
    row.evidenceStatus,
    csvJoin(row.flags),
    row.researchPrompts[index],
  ]);

export const playerEvidenceTemplateCsv = (
  queue: PlayerEvidenceQueue,
): string =>
  [
    headers.map(csvCell).join(","),
    ...queue.rows.flatMap(templateRowsFor).map(row => row.map(csvCell).join(",")),
  ].join("\n");
