import { keeperScenarioSensitivityKeys } from "./constants.js";
import type {
  BuildKeeperScenarioSensitivityReportOptions,
  KeeperScenarioSensitivityReport,
  UnrankedSensitivityRow,
} from "./contracts.js";
import { defaultKeeperScenarioSensitivityLimit } from "./constants.js";
import { rowForPrice, rowForUnpricedKeeper } from "./buildRows.js";
import { average, roundToTwo } from "./math.js";
import { sortSensitivityRows } from "./rowMetrics.js";
import { buildScenarioResources } from "./scenarioResources.js";
import { unpricedKeepersFor } from "./unpricedKeepers.js";

const reportedRows = (
  allRows: readonly UnrankedSensitivityRow[],
  limit: number,
) => allRows.slice(0, limit).map((row, index) => ({ rank: index + 1, ...row }));

export const buildKeeperScenarioSensitivityReport = ({
  prices,
  keepers,
  limit = defaultKeeperScenarioSensitivityLimit,
}: BuildKeeperScenarioSensitivityReportOptions): KeeperScenarioSensitivityReport => {
  const resources = buildScenarioResources(prices, keepers);
  const unpricedKeepers = unpricedKeepersFor(prices, keepers);
  const allRows = prices.map(price => rowForPrice(
    price,
    resources.scenarioPriceMaps,
    resources.keeperReasonMaps,
  )).concat(unpricedKeepers.map(keeper => rowForUnpricedKeeper(
    keeper,
    resources.keeperReasonMaps,
  ))).sort(sortSensitivityRows);
  const rows = reportedRows(allRows, limit);
  const spreads = allRows.flatMap(row => row.priceSpread === null ? [] : [row.priceSpread]);

  return {
    summary: {
      scenarioKeys: [...keeperScenarioSensitivityKeys],
      playerCount: allRows.length,
      reportedPlayerCount: rows.length,
      limit,
      truncated: allRows.length > rows.length,
      keeperRemovedCount: allRows.filter(row => row.keeperRemoved).length,
      keeperRemovalChangeCount: allRows.filter(row => row.keeperRemovalChanged).length,
      availabilityChangeCount: allRows.filter(row => row.availabilityChanged).length,
      reportedKeeperRemovalChangeCount: rows.filter(row => row.keeperRemovalChanged).length,
      reportedAvailabilityChangeCount: rows.filter(row => row.availabilityChanged).length,
      pricedPlayerCount: prices.length,
      unpricedKeeperCount: unpricedKeepers.length,
      maxPriceSpread: spreads.length === 0 ? 0 : Math.max(...spreads),
      averagePriceSpread: roundToTwo(average(spreads)),
    },
    rows,
  };
};
