import type {
  PlayerOutlierReviewQueue,
  PlayerOutlierReviewRow,
} from "./contracts.js";

type CsvValue = string | number | undefined;

const csvCell = (value: CsvValue): string => {
  const text = value === undefined ? "" : String(value);
  if (!/[",\n;]/.test(text)) return text;
  return `"${text.replaceAll("\"", "\"\"")}"`;
};

const csvJoin = (values: readonly string[]): string => values.join("; ");

const header = [
  "priority", "rank", "player", "position", "public_anchor_value",
  "base_price", "scenario_price", "average_mock_sale_price",
  "sale_vs_scenario_price", "min_mock_sale_price", "max_mock_sale_price",
  "mock_sale_range", "drafted_rate", "rank_gap",
  "context_adjustment_percent", "current_evidence_count", "primary_reason",
  "outlier_reasons", "thresholds", "audit_command", "review_status",
  "review_note",
];

const valuesFor = (row: PlayerOutlierReviewRow): CsvValue[] => [
  row.priority,
  row.rank,
  row.player,
  row.position,
  row.publicAnchorValue,
  row.basePrice,
  row.scenarioPrice,
  row.averageMockSalePrice,
  row.saleVsScenarioPrice,
  row.minMockSalePrice,
  row.maxMockSalePrice,
  row.mockSaleRange,
  row.draftedRate,
  row.rankGap ?? undefined,
  row.contextAdjustmentPercent,
  row.currentEvidenceCount,
  row.primaryReason,
  csvJoin(row.outlierReasons.map(reason => reason.key)),
  csvJoin(row.thresholds),
  row.auditCommand,
  row.reviewStatus,
  row.reviewNote,
];

export const playerOutlierReviewQueueCsv = (
  queue: PlayerOutlierReviewQueue,
): string => [
  header.map(csvCell).join(","),
  ...queue.rows.map(row => valuesFor(row).map(csvCell).join(",")),
].join("\n");
