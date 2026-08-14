import type { HistoricalCalibrationAudit } from "../calibrationAudit.js";
import { toCsv } from "./csv.js";

export const priceTierCalibrationCsv = (
  audit: HistoricalCalibrationAudit,
): string =>
  toCsv(
    [
      "tier", "label", "historical_average_price", "mock_average_price",
      "price_delta", "historical_average_count", "mock_average_count",
      "count_delta",
    ],
    audit.priceTiers.map(tier => [
      tier.key, tier.label, tier.historicalAveragePrice, tier.mockAveragePrice,
      tier.priceDelta, tier.historicalAverageCount, tier.mockAverageCount,
      tier.countDelta,
    ]),
  );

export const highPriceVolumeCalibrationCsv = (
  audit: HistoricalCalibrationAudit,
): string =>
  toCsv(
    [
      "threshold", "historical_average_count", "historical_max_count",
      "mock_average_count", "mock_max_count", "average_count_delta",
      "max_count_delta",
    ],
    audit.highPriceVolumes.map(volume => [
      volume.threshold, volume.historicalAverageCount, volume.historicalMaxCount,
      volume.mockAverageCount, volume.mockMaxCount, volume.averageCountDelta,
      volume.maxCountDelta,
    ]),
  );

export const positionCountCalibrationCsv = (
  audit: HistoricalCalibrationAudit,
): string =>
  toCsv(
    ["position", "historical_average_count", "mock_average_count", "delta"],
    audit.positionCounts.map(position => [
      position.position, position.historicalAverageCount,
      position.mockAverageCount, position.delta,
    ]),
  );

export const positionSpendCalibrationCsv = (
  audit: HistoricalCalibrationAudit,
): string =>
  toCsv(
    [
      "position", "historical_average_spend", "scenario_average_spend_target",
      "mock_average_spend", "historical_delta", "scenario_delta",
    ],
    audit.positionSpend.map(position => [
      position.position, position.historicalAverageSpend,
      position.scenarioAverageSpendTarget, position.mockAverageSpend,
      position.delta, position.scenarioSpendDelta,
    ]),
  );

export const scenarioCalibrationCsv = (
  audit: HistoricalCalibrationAudit,
): string =>
  toCsv(
    [
      "scenario", "label", "run_count", "invalid_roster_count",
      "average_pick_count", "scenario_open_auction_dollars",
      "mock_auction_spend", "scenario_spend_delta",
      "league_average_budget_remaining", "max_owner_average_budget_remaining",
    ],
    audit.scenarios.map(scenario => [
      scenario.key, scenario.label, scenario.runCount,
      scenario.invalidRosterCount, scenario.averagePickCount,
      scenario.scenarioAverageOpenAuctionDollars,
      scenario.mockAverageAuctionSpend, scenario.scenarioAuctionSpendDelta,
      scenario.leagueAverageBudgetRemaining,
      scenario.maxOwnerAverageBudgetRemaining,
    ]),
  );
