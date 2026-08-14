import type { ScenarioAdjustedPrice } from "../keeperInflation.js";
import {
  contextPenaltyThreshold,
  expensiveMissingEvidenceThreshold,
  extremeProjectionLiftThreshold,
  highMockPremiumThreshold,
  largeProjectionLiftPriceThreshold,
  largeProjectionLiftThreshold,
} from "./constants.js";
import type { MockSaleSummary, SanityFlag } from "./contracts.js";
import { roundToTwo } from "./math.js";

export const flagsFor = (
  player: ScenarioAdjustedPrice,
  sale: MockSaleSummary,
): SanityFlag[] => {
  const flags: SanityFlag[] = [];
  if (sale.saleVsScenarioPrice >= highMockPremiumThreshold) {
    flags.push({
      key: "highMockPremium",
      severity: "review",
      message: `Mock sale average is $${sale.saleVsScenarioPrice} above the scenario anchor.`,
    });
  }
  const rankGap = player.rankGap ?? 0;
  const projectionLift = player.scenarioPrice >= largeProjectionLiftPriceThreshold
    && rankGap <= largeProjectionLiftThreshold;
  if (projectionLift || rankGap <= extremeProjectionLiftThreshold) {
    flags.push({
      key: "largeProjectionRankLift",
      severity: "review",
      message: `Projection rank is ${Math.abs(rankGap)} spot(s) higher than ESPN rank.`,
    });
  }
  if (player.scenarioPrice >= expensiveMissingEvidenceThreshold && !player.contextEvidence?.length) {
    flags.push({
      key: "missingFactualEvidence",
      severity: "review",
      message: "Expensive player has no factual evidence rows attached.",
    });
  }
  if (player.contextAdjustmentPercent <= contextPenaltyThreshold) {
    flags.push({
      key: "contextPenalty",
      severity: "info",
      message: `Context adjustment trims price by ${Math.abs(roundToTwo(player.contextAdjustmentPercent * 100))}%.`,
    });
  }
  if (player.price >= player.hardCeiling) {
    flags.push({
      key: "hardCeilingPressure",
      severity: "info",
      message: `Base price is at the ${player.position} hard ceiling.`,
    });
  }
  return flags;
};
