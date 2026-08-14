import type { PlayerBatchSummary } from "../mockBatch.js";
import type {
  DraftPlanCandidate,
  DraftPlanRecommendations,
  DraftPlanStrategyDefinition,
  DraftPlanTargetCluster,
} from "./contracts.js";
import { priceBandText } from "./formatters.js";
import { strategyCoachFor } from "./coaching/strategyCoach.js";
import { strategyPlanRules } from "./strategyPlanRules.js";
import { threeRbPathRules } from "./threeRbPathRules.js";

export const buildRecommendations = (
  candidates: readonly DraftPlanCandidate[],
  marketPlayers: readonly PlayerBatchSummary[],
  strategy: DraftPlanStrategyDefinition,
): DraftPlanRecommendations => {
  const topCandidate = candidates[0];
  const rules = strategyPlanRules[strategy.key];
  const rbBands = rules.priceBands.filter(band => band.position === "RB");
  const wrBands = rules.priceBands.filter(band => band.position === "WR");
  const teBand = rules.priceBands.find(band => band.position === "TE");
  const targetClusters: DraftPlanTargetCluster[] = [];

  if (topCandidate) {
    targetClusters.push({
      label: strategy.key === "three-rb" ? "RB core" : "RB starters",
      position: "RB",
      targetNames: topCandidate.rbCore
        .slice(0, strategy.key === "three-rb" ? 3 : 2)
        .map(player => player.name),
      priceBand: rbBands.map(priceBandText).join(" / "),
      note: strategy.key === "three-rb"
        ? `The true 3RB build works when three startable RBs fit inside about $${threeRbPathRules.rbCoreBudget.minimumSpend}-$${threeRbPathRules.rbCoreBudget.hardBudget} of core RB spend.`
        : "Use RB prices as a budget lane, then let the WR/TE board decide where the next dollar creates the most weekly points.",
    });

    const wrTargets = topCandidate.players
      .filter(player => player.position === "WR")
      .slice(0, 3)
      .map(player => player.name);
    if (wrTargets.length) {
      targetClusters.push({
        label: strategy.key === "wr-heavy" ? "WR core" : "WR values",
        position: "WR",
        targetNames: wrTargets,
        priceBand: wrBands.map(priceBandText).join(" / "),
        note: strategy.key === "wr-heavy"
          ? "WR-heavy builds need real receiver strength, but still need price discipline after the first two buys."
          : "Fill WR starters from the value pocket after the RB budget envelope is protected.",
      });
    }

    const teTargets = topCandidate.players
      .filter(player => player.position === "TE")
      .slice(0, 2)
      .map(player => player.name);
    if (teTargets.length && teBand) {
      targetClusters.push({
        label: "Cheap TE",
        position: "TE",
        targetNames: teTargets,
        priceBand: priceBandText(teBand),
        note: "Avoid paying up at TE unless the RB core came in under plan.",
      });
    }
  }

  return {
    maxPriceBands: rules.priceBands.map(band => ({ ...band })),
    targetClusters,
    pivotRules: rules.pivotRules.map(rule => ({ ...rule })),
    deadZoneWarnings: topCandidate ? [] : [`No sampled roster matched the ${strategy.label} path.`],
    strategyCoach: strategyCoachFor(candidates, marketPlayers, strategy),
  };
};
