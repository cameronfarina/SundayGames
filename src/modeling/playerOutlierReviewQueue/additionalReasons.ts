import type {
  TopPlayerSanityReport,
  TopPlayerSanityRow,
} from "../topPlayerSanity.js";
import {
  anchorJumpMinimumDollars,
  anchorJumpMinimumRatio,
  mockSaleDiscountThreshold,
  mockSaleRangeThreshold,
  thinDemandDraftedRateThreshold,
  thinDemandMinimumRuns,
  thinDemandMinimumScenarioPrice,
} from "./constants.js";
import type { PlayerOutlierReason } from "./contracts.js";
import { reviewedEliteThresholdsFor } from "./eliteThresholds.js";
import { roundToTwo } from "./numbers.js";

export const additionalReasonsFor = (
  player: TopPlayerSanityRow,
  report: TopPlayerSanityReport,
): PlayerOutlierReason[] => {
  const reasons: PlayerOutlierReason[] = [];
  const mockSaleRange = player.maxMockSalePrice - player.minMockSalePrice;

  if (player.saleVsScenarioPrice <= mockSaleDiscountThreshold) {
    reasons.push({
      key: "mockSaleDiscount",
      severity: "review",
      message: `Mock sale average is $${Math.abs(player.saleVsScenarioPrice)} below the scenario anchor.`,
      threshold: `<= $${mockSaleDiscountThreshold} vs scenario`,
      actual: `$${player.saleVsScenarioPrice}`,
    });
  }
  if (mockSaleRange >= mockSaleRangeThreshold) {
    reasons.push({
      key: "mockSaleRange",
      severity: "review",
      message: `Mock sale range spans $${mockSaleRange}.`,
      threshold: `>= $${mockSaleRangeThreshold} range`,
      actual: `$${mockSaleRange}`,
    });
  }
  if (
    report.config.runs >= thinDemandMinimumRuns
    && player.scenarioPrice >= thinDemandMinimumScenarioPrice
    && player.draftedRate < thinDemandDraftedRateThreshold
  ) {
    reasons.push({
      key: "thinMockDemand",
      severity: "review",
      message: `Drafted in only ${roundToTwo(player.draftedRate * 100)}% of mock runs.`,
      threshold: `scenario >= $${thinDemandMinimumScenarioPrice} and drafted rate < ${thinDemandDraftedRateThreshold}`,
      actual: `${player.draftedRate}`,
    });
  }

  const anchorJump = player.scenarioPrice - player.publicAnchorValue;
  const anchorRatio = player.publicAnchorValue > 0
    ? player.scenarioPrice / player.publicAnchorValue
    : 0;
  if (anchorJump >= anchorJumpMinimumDollars && anchorRatio >= anchorJumpMinimumRatio) {
    reasons.push({
      key: "anchorToScenarioJump",
      severity: "review",
      message: `Scenario price is $${anchorJump} above the public anchor.`,
      threshold: `>= $${anchorJumpMinimumDollars} and >= ${anchorJumpMinimumRatio}x public anchor`,
      actual: `$${anchorJump}, ${roundToTwo(anchorRatio)}x`,
    });
  }

  const eliteThresholds = reviewedEliteThresholdsFor(
    player,
    report.summary.highPriceVolume,
  );
  if (eliteThresholds.length > 0) {
    reasons.push({
      key: "eliteTierContributor",
      severity: "review",
      message: "Player contributes to a reviewed elite-price volume threshold.",
      threshold: eliteThresholds.map(volume => `$${volume.threshold}+`).join(", "),
      actual: `scenario $${player.scenarioPrice}, mock average $${player.averageMockSalePrice}, mock max $${player.maxMockSalePrice}`,
    });
  }
  return reasons;
};
