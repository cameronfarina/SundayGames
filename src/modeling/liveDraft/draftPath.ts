import type { LiveDraftStrategyDefinition } from "../liveDraftStrategies.js";
import type {
  LiveDraftOwnerState,
  LiveDraftPathRecommendation,
  LiveDraftTarget,
} from "./contracts.js";
import { allPositions } from "./constants.js";
import { buildThreeRbDraftPath, targetNamesFor } from "./draftPath/threeRbPath.js";

export const buildDraftPath = (
  strategy: LiveDraftStrategyDefinition,
  watchOwner: LiveDraftOwnerState,
  availableTargets: readonly LiveDraftTarget[],
): LiveDraftPathRecommendation => {
  if (strategy.key === "three-rb") {
    return buildThreeRbDraftPath(strategy, watchOwner, availableTargets);
  }
  const focusPositions = allPositions.filter(position => Boolean(strategy.tags[position]));
  return {
    strategyKey: strategy.key,
    label: strategy.label,
    summary: `${strategy.label} path: follow the live board tags and keep max bids under the primary team's current room cap.`,
    maxPriceBands: [],
    targetClusters: focusPositions.map(position => ({
      label: "Target",
      position,
      targetNames: targetNamesFor(availableTargets, position, 5),
      priceBand: "Live value",
      note: `Current ${strategy.label} targets at ${position}.`,
    })),
    pivotRules: [{
      label: "Pivot",
      trigger: "Core strategy targets clear above the primary team's max bid.",
      action: "Move to best value-score targets that still fill starter or flex needs.",
    }],
    riskAlerts: [],
    deadZoneWarnings: [],
  };
};
