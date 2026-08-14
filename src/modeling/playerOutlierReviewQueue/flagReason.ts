import type {
  SanityFlag,
  SanityFlagKey,
  TopPlayerSanityRow,
} from "../topPlayerSanity.js";
import type { PlayerOutlierReason } from "./contracts.js";
import { mockSalePremiumThreshold } from "./constants.js";
import { roundToTwo } from "./numbers.js";

const thresholdFor = (key: SanityFlagKey): string => {
  if (key === "highMockPremium") {
    return `>= $${mockSalePremiumThreshold} over scenario`;
  }
  if (key === "largeProjectionRankLift") {
    return "rank gap <= -5 for expensive players or <= -30 overall";
  }
  if (key === "missingFactualEvidence") {
    return "scenario price >= $50 and evidence count = 0";
  }
  if (key === "contextPenalty") return "<= -3% context adjustment";
  return "base price at hard ceiling";
};

const actualFor = (
  key: SanityFlagKey,
  player: TopPlayerSanityRow,
): string => {
  if (key === "highMockPremium") return `$${player.saleVsScenarioPrice}`;
  if (key === "largeProjectionRankLift") {
    return player.rankGap === null ? "n/a" : String(player.rankGap);
  }
  if (key === "missingFactualEvidence") {
    return `${player.contextEvidenceCount} evidence row(s)`;
  }
  if (key === "contextPenalty") {
    return `${roundToTwo(player.contextAdjustmentPercent * 100)}%`;
  }
  return `$${player.basePrice}`;
};

export const reasonForFlag = (
  flag: SanityFlag,
  player: TopPlayerSanityRow,
): PlayerOutlierReason => ({
  key: flag.key,
  severity: flag.severity,
  message: flag.message,
  threshold: thresholdFor(flag.key),
  actual: actualFor(flag.key, player),
});
