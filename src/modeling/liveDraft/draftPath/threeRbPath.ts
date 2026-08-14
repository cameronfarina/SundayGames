import { threeRbPathRules } from "../../draftPlan.js";
import type {
  LiveDraftOwnerState,
  LiveDraftPathRecommendation,
  LiveDraftPathTargetCluster,
  LiveDraftTarget,
} from "../contracts.js";
import type { LiveDraftStrategyDefinition } from "../../liveDraftStrategies.js";
import { maxPriceBandsForThreeRb, priceBandText } from "./priceBands.js";
import { threeRbRiskAlertsFor } from "./riskAlerts.js";

const targetNamesFor = (
  targets: readonly LiveDraftTarget[],
  position: LiveDraftTarget["position"],
  limit: number,
): string[] => targets
  .filter(target => target.position === position)
  .filter(target => target.recommendedMaxBid > 0)
  .slice(0, limit)
  .map(target => target.name);

const targetClustersFor = (
  availableTargets: readonly LiveDraftTarget[],
  nextRbBand: ReturnType<typeof maxPriceBandsForThreeRb>[number] | undefined,
  wrBandText: string,
  teBand: ReturnType<typeof maxPriceBandsForThreeRb>[number] | undefined,
): LiveDraftPathTargetCluster[] => {
  const clusters: LiveDraftPathTargetCluster[] = [];
  if (nextRbBand) clusters.push({
    label: "Target",
    position: "RB",
    targetNames: targetNamesFor(availableTargets, "RB", 5),
    priceBand: priceBandText(nextRbBand),
    note: `${nextRbBand.slot} is the next premium RB lane.`,
  });
  clusters.push({
    label: "Target",
    position: "WR",
    targetNames: targetNamesFor(availableTargets, "WR", 5),
    priceBand: wrBandText,
    note: "WR values should fill starters after the RB core is protected.",
  });
  if (teBand) clusters.push({
    label: "Target",
    position: "TE",
    targetNames: targetNamesFor(availableTargets, "TE", 3),
    priceBand: priceBandText(teBand),
    note: "Cheap TE keeps the path from taxing RB and WR slots.",
  });
  return clusters;
};

export const buildThreeRbDraftPath = (
  strategy: LiveDraftStrategyDefinition,
  watchOwner: LiveDraftOwnerState,
  availableTargets: readonly LiveDraftTarget[],
): LiveDraftPathRecommendation => {
  const maxPriceBands = maxPriceBandsForThreeRb(watchOwner);
  const nextRbBand = maxPriceBands.find(band => band.position === "RB" && band.status === "next");
  const openRbCoreCount = Math.max(0, 3 - watchOwner.positionCounts.RB);
  const wrBandText = maxPriceBands.filter(band => band.position === "WR").map(priceBandText).join(" / ");
  const deadZoneWarnings: string[] = [];
  if (openRbCoreCount > 0 && !targetNamesFor(availableTargets, "RB", 1).length) {
    deadZoneWarnings.push("Dead zone: no RB targets remain for the 3RB path.");
  }
  if (nextRbBand && watchOwner.maxBid < nextRbBand.minimumPrice) {
    deadZoneWarnings.push(
      `Dead zone: the primary team's max bid is below the ${nextRbBand.slot} ${priceBandText(nextRbBand)} lane.`,
    );
  }
  return {
    strategyKey: strategy.key,
    label: strategy.label,
    summary: nextRbBand
      ? `3RB path: ${3 - openRbCoreCount}/3 core RBs filled. Next ${nextRbBand.slot} lane is ${priceBandText(nextRbBand)}.`
      : "3RB path: RB core filled. Shift attention to WR value and cheap TE.",
    maxPriceBands,
    targetClusters: targetClustersFor(
      availableTargets,
      nextRbBand,
      wrBandText,
      maxPriceBands.find(band => band.position === "TE"),
    ),
    pivotRules: threeRbPathRules.pivotRules.map(rule => ({
      label: "Pivot", trigger: rule.trigger, action: rule.action,
    })),
    riskAlerts: threeRbRiskAlertsFor(watchOwner, maxPriceBands),
    deadZoneWarnings,
  };
};

export { targetNamesFor };
