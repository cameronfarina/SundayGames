import type { FactualPlayerContextCategory } from "../../../config/playerContext.js";
import type { TopPlayerSanityRow } from "../topPlayerSanity.js";
import type {
  PlayerEvidenceQueuePriority,
  PlayerEvidenceQueueRow,
  PlayerEvidenceStatus,
} from "./contracts.js";
import { categoriesByFlag, categoryOrder, priorityScore, promptByCategory } from "./policy.js";

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

const categoriesFor = (player: TopPlayerSanityRow): FactualPlayerContextCategory[] =>
  unique(player.flags.flatMap(flag => categoriesByFlag[flag.key]))
    .sort((left, right) => (categoryOrder.get(left) ?? 0) - (categoryOrder.get(right) ?? 0));

const priorityFor = (player: TopPlayerSanityRow): PlayerEvidenceQueuePriority => {
  const flagKeys = new Set(player.flags.map(flag => flag.key));
  const reviewFlagCount = player.flags.filter(flag => flag.severity === "review").length;
  if (
    (flagKeys.has("missingFactualEvidence") && player.scenarioPrice >= 50) ||
    (flagKeys.has("highMockPremium") && player.scenarioPrice >= 50)
  ) return "high";
  return reviewFlagCount > 0 || player.flags.length > 0 ? "medium" : "low";
};

const evidenceStatusFor = (
  player: TopPlayerSanityRow,
  categories: readonly FactualPlayerContextCategory[],
): PlayerEvidenceStatus => {
  const covered = new Set((player.contextEvidence ?? []).map(evidence => evidence.category));
  const count = categories.filter(category => covered.has(category)).length;
  if (count === 0) return "missing";
  return count < categories.length ? "partial" : "present";
};

export const compareEvidenceRows = (
  left: PlayerEvidenceQueueRow,
  right: PlayerEvidenceQueueRow,
): number =>
  priorityScore[right.priority] - priorityScore[left.priority] ||
  right.scenarioPrice - left.scenarioPrice ||
  left.rank - right.rank ||
  left.player.localeCompare(right.player);

export const evidenceRowFor = (player: TopPlayerSanityRow): PlayerEvidenceQueueRow => {
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
