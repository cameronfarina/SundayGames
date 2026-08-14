import {
  type FactualPlayerContextCategory,
  factualPlayerContextCategories,
  type PlayerContextEvidence,
} from "../../config/playerContext.js";
import type {
  SanityFlagKey,
  TopPlayerSanityReport,
  TopPlayerSanityRow,
} from "./topPlayerSanity.js";

export type PlayerEvidenceQueuePriority = "high" | "medium" | "low";
export type PlayerEvidenceStatus = "missing" | "partial" | "present";

export interface PlayerEvidenceQueueRow {
  priority: PlayerEvidenceQueuePriority;
  rank: number;
  player: string;
  position: string;
  scenarioPrice: number;
  averageMockSalePrice: number;
  saleVsScenarioPrice: number;
  currentEvidenceCount: number;
  currentEvidence?: readonly PlayerContextEvidence[];
  evidenceStatus: PlayerEvidenceStatus;
  flags: SanityFlagKey[];
  categories: FactualPlayerContextCategory[];
  researchPrompts: string[];
}

export interface PlayerEvidenceQueueSummary {
  playerCount: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
  categoryCounts: Partial<Record<FactualPlayerContextCategory, number>>;
}

export interface PlayerEvidenceQueue {
  summary: PlayerEvidenceQueueSummary;
  rows: PlayerEvidenceQueueRow[];
}

type CsvValue = string | number | boolean | undefined;

const categoriesByFlag: Record<SanityFlagKey, readonly FactualPlayerContextCategory[]> = {
  highMockPremium: ["opportunity", "defensiveAttention", "environment"],
  largeProjectionRankLift: ["opportunity", "defensiveAttention", "skillFit"],
  missingFactualEvidence: [...factualPlayerContextCategories],
  contextPenalty: ["risk", "environment"],
  hardCeilingPressure: ["opportunity", "skillFit", "risk"],
};

const promptByCategory: Record<FactualPlayerContextCategory, string> = {
  opportunity: "Opportunity: Validate role, routes/targets/touches, and whether the Weeks 1-4 projection is sustainable.",
  defensiveAttention: "Defensive attention: Check whether the player is gaining or losing true No. 1 defensive attention.",
  skillFit: "Skill fit: Compare separation, efficiency, explosive-play, or usage traits against the projected role.",
  environment: "Environment: Check team, quarterback, coordinator, pace, pass rate, and scoring-context changes.",
  risk: "Risk: Check injury, suspension, contract, holdout, age, and role-volatility downside.",
};

const priorityScore: Record<PlayerEvidenceQueuePriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const categoryOrder = new Map(
  factualPlayerContextCategories.map((category, index) => [category, index]),
);

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

const categoriesFor = (player: TopPlayerSanityRow): FactualPlayerContextCategory[] =>
  unique(player.flags.flatMap(flag => categoriesByFlag[flag.key]))
    .sort((left, right) => (categoryOrder.get(left) ?? 0) - (categoryOrder.get(right) ?? 0));

const priorityFor = (
  player: TopPlayerSanityRow,
): PlayerEvidenceQueuePriority => {
  const flagKeys = new Set(player.flags.map(flag => flag.key));
  const reviewFlagCount = player.flags.filter(flag => flag.severity === "review").length;

  if (
    (flagKeys.has("missingFactualEvidence") && player.scenarioPrice >= 50) ||
    (flagKeys.has("highMockPremium") && player.scenarioPrice >= 50)
  ) {
    return "high";
  }

  if (reviewFlagCount > 0 || player.flags.length > 0) return "medium";
  return "low";
};

const evidenceStatusFor = (
  player: TopPlayerSanityRow,
  categories: readonly FactualPlayerContextCategory[],
): PlayerEvidenceStatus => {
  const coveredCategories = new Set((player.contextEvidence ?? []).map(evidence => evidence.category));
  const coveredCategoryCount = categories.filter(category => coveredCategories.has(category)).length;

  if (coveredCategoryCount === 0) return "missing";
  if (coveredCategoryCount < categories.length) return "partial";
  return "present";
};

const sortRows = (
  left: PlayerEvidenceQueueRow,
  right: PlayerEvidenceQueueRow,
): number =>
  priorityScore[right.priority] - priorityScore[left.priority] ||
  right.scenarioPrice - left.scenarioPrice ||
  left.rank - right.rank ||
  left.player.localeCompare(right.player);

const rowFor = (player: TopPlayerSanityRow): PlayerEvidenceQueueRow => {
  const categories = categoriesFor(player);

  return {
    priority: priorityFor(player),
    rank: player.rank,
    player: player.name,
    position: player.position,
    scenarioPrice: player.scenarioPrice,
    averageMockSalePrice: player.averageMockSalePrice,
    saleVsScenarioPrice: player.saleVsScenarioPrice,
    currentEvidenceCount: player.contextEvidenceCount,
    ...(player.contextEvidence ? { currentEvidence: player.contextEvidence } : {}),
    evidenceStatus: evidenceStatusFor(player, categories),
    flags: player.flags.map(flag => flag.key),
    categories,
    researchPrompts: categories.map(category => promptByCategory[category]),
  };
};

const categoryCountsFor = (
  rows: readonly PlayerEvidenceQueueRow[],
): Partial<Record<FactualPlayerContextCategory, number>> => {
  const counts: Partial<Record<FactualPlayerContextCategory, number>> = {};

  for (const row of rows) {
    for (const category of row.categories) {
      counts[category] = (counts[category] ?? 0) + 1;
    }
  }

  return counts;
};

const summaryFor = (
  rows: readonly PlayerEvidenceQueueRow[],
): PlayerEvidenceQueueSummary => ({
  playerCount: rows.length,
  highPriorityCount: rows.filter(row => row.priority === "high").length,
  mediumPriorityCount: rows.filter(row => row.priority === "medium").length,
  lowPriorityCount: rows.filter(row => row.priority === "low").length,
  categoryCounts: categoryCountsFor(rows),
});

export const buildPlayerEvidenceQueue = (
  report: TopPlayerSanityReport,
): PlayerEvidenceQueue => {
  const rows = report.flaggedPlayers
    .filter(player => player.flags.length > 0)
    .map(rowFor)
    .sort(sortRows);

  return {
    summary: summaryFor(rows),
    rows,
  };
};

const csvCell = (value: CsvValue): string => {
  const text = value === undefined ? "" : String(value);
  if (!/[",\n;]/.test(text)) return text;
  return `"${text.replaceAll("\"", "\"\"")}"`;
};

const csvJoin = (values: readonly string[]): string => values.join("; ");

export const playerEvidenceQueueCsv = (
  queue: PlayerEvidenceQueue,
): string =>
  [
    [
      "priority",
      "rank",
      "player",
      "position",
      "scenario_price",
      "average_mock_sale_price",
      "sale_vs_scenario_price",
      "current_evidence_count",
      "evidence_status",
      "flags",
      "categories",
      "research_prompts",
    ].map(csvCell).join(","),
    ...queue.rows.map(row => [
      row.priority,
      row.rank,
      row.player,
      row.position,
      row.scenarioPrice,
      row.averageMockSalePrice,
      row.saleVsScenarioPrice,
      row.currentEvidenceCount,
      row.evidenceStatus,
      csvJoin(row.flags),
      csvJoin(row.categories),
      csvJoin(row.researchPrompts),
    ].map(csvCell).join(",")),
  ].join("\n");
