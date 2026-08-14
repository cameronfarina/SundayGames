import type { TopPlayerSanityRow } from "../topPlayerSanity.js";
import type {
  PlayerOutlierPriority,
  PlayerOutlierReason,
  PlayerOutlierReasonKey,
  PlayerOutlierReviewRow,
} from "./contracts.js";

const priorityScore: Record<PlayerOutlierPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const primaryReasonScore: Record<PlayerOutlierReasonKey, number> = {
  highMockPremium: 100,
  mockSaleDiscount: 95,
  thinMockDemand: 90,
  eliteTierContributor: 85,
  largeProjectionRankLift: 80,
  missingFactualEvidence: 75,
  hardCeilingPressure: 70,
  mockSaleRange: 60,
  anchorToScenarioJump: 50,
  contextPenalty: 10,
};

export const priorityFor = (
  player: TopPlayerSanityRow,
  reasons: readonly PlayerOutlierReason[],
): PlayerOutlierPriority => {
  const highPriority = reasons.some(reason =>
    reason.key === "highMockPremium"
    || reason.key === "mockSaleDiscount"
    || reason.key === "thinMockDemand"
    || reason.key === "eliteTierContributor"
    || reason.key === "hardCeilingPressure"
    || (reason.key === "largeProjectionRankLift" && player.scenarioPrice >= 45)
    || (reason.key === "missingFactualEvidence" && player.scenarioPrice >= 50),
  );
  if (highPriority) return "high";
  return reasons.some(reason => reason.severity === "review") ? "medium" : "low";
};

export const primaryReasonFor = (
  reasons: readonly PlayerOutlierReason[],
): PlayerOutlierReasonKey =>
  [...reasons].sort((left, right) =>
    primaryReasonScore[right.key] - primaryReasonScore[left.key]
    || left.key.localeCompare(right.key),
  )[0]?.key ?? "highMockPremium";

export const sortRows = (
  left: PlayerOutlierReviewRow,
  right: PlayerOutlierReviewRow,
): number =>
  priorityScore[right.priority] - priorityScore[left.priority]
  || right.scenarioPrice - left.scenarioPrice
  || left.rank - right.rank
  || left.player.localeCompare(right.player);
