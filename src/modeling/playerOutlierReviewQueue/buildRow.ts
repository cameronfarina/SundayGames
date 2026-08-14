import type { KeeperScenarioKey } from "../keeperInflation.js";
import type {
  TopPlayerSanityReport,
  TopPlayerSanityRow,
} from "../topPlayerSanity.js";
import type { PlayerOutlierReviewRow } from "./contracts.js";
import { reviewedEliteThresholdsFor } from "./eliteThresholds.js";
import { primaryReasonFor, priorityFor } from "./priority.js";
import { reasonsFor } from "./reasons.js";

const auditCommandFor = (
  player: TopPlayerSanityRow,
  scenarioKey: KeeperScenarioKey,
): string =>
  `npm run audit -- --player="${player.name.replaceAll("\"", "\\\"")}" --scenario=${scenarioKey}`;

export const buildReviewRow = (
  player: TopPlayerSanityRow,
  report: TopPlayerSanityReport,
): PlayerOutlierReviewRow | undefined => {
  const outlierReasons = reasonsFor(player, report);
  if (outlierReasons.length === 0) return undefined;

  const thresholds = outlierReasons.flatMap(reason =>
    reason.key === "eliteTierContributor"
      ? reviewedEliteThresholdsFor(player, report.summary.highPriceVolume)
        .map(volume =>
          `$${volume.threshold} volume exceeds historical max ${volume.historicalMaxCount}`,
        )
      : [reason.threshold],
  );

  return {
    priority: priorityFor(player, outlierReasons),
    rank: player.rank,
    player: player.name,
    position: player.position,
    publicAnchorValue: player.publicAnchorValue,
    basePrice: player.basePrice,
    scenarioPrice: player.scenarioPrice,
    averageMockSalePrice: player.averageMockSalePrice,
    saleVsScenarioPrice: player.saleVsScenarioPrice,
    minMockSalePrice: player.minMockSalePrice,
    maxMockSalePrice: player.maxMockSalePrice,
    mockSaleRange: player.maxMockSalePrice - player.minMockSalePrice,
    draftedRate: player.draftedRate,
    rankGap: player.rankGap,
    contextAdjustmentPercent: player.contextAdjustmentPercent,
    currentEvidenceCount: player.contextEvidenceCount,
    primaryReason: primaryReasonFor(outlierReasons),
    outlierReasons,
    thresholds,
    auditCommand: auditCommandFor(player, report.config.scenarioKey),
    reviewStatus: "open",
    reviewNote: "",
  };
};
