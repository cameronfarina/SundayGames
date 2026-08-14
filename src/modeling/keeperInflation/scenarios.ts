import { positions } from "../../../config/league.js";
import type { KeeperDeclaration, KeeperStatus } from "../../../config/keepers.js";
import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { BasePrice } from "../basePricing.js";
import { defaultKeeperScenarioConfig } from "./defaultConfig.js";
import type {
  AppliedKeeperScenario,
  KeeperScenario,
  KeeperScenarioConfig,
  PositionAmounts,
} from "./contracts.js";

const emptyPositionAmounts = (): PositionAmounts => ({ QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 });
const declaredKeepersFor = (
  keepers: readonly KeeperDeclaration[],
  statuses: readonly KeeperStatus[],
): KeeperDeclaration[] => keepers.filter(keeper => statuses.some(status => status === keeper.status));

const countDeclaredKeepers = (keepers: readonly KeeperDeclaration[]): PositionAmounts => {
  const counts = emptyPositionAmounts();
  for (const keeper of keepers) counts[keeper.position] += 1;
  return counts;
};

const mapPositionAmounts = (
  valueFor: (position: (typeof positions)[number]) => number,
): PositionAmounts => {
  const amounts = emptyPositionAmounts();
  for (const position of positions) amounts[position] = valueFor(position);
  return amounts;
};

const totalAverageKeeperCost = (counts: PositionAmounts, costs: PositionAmounts): number =>
  positions.reduce((total, position) => total + counts[position] * costs[position], 0);

const positionFactorsFor = (
  keeperCounts: PositionAmounts,
  globalFactor: number,
  config: KeeperScenarioConfig,
): PositionAmounts => mapPositionAmounts(position => {
  const keeperCountDelta = keeperCounts[position] - config.typicalKeeperCounts[position];
  return globalFactor * (1 + keeperCountDelta * config.scarcityRates[position]);
});

export const buildKeeperScenarios = (
  keepers: readonly KeeperDeclaration[],
  config: KeeperScenarioConfig = defaultKeeperScenarioConfig,
): KeeperScenario[] => config.scenarios.map(definition => {
  const declaredKeepers = declaredKeepersFor(keepers, definition.includedKeeperStatuses);
  const declaredCounts = countDeclaredKeepers(declaredKeepers);
  const keeperCounts = definition.keeperCounts === undefined
    ? declaredCounts
    : mapPositionAmounts(position => Math.max(definition.keeperCounts?.[position] ?? 0, declaredCounts[position]));
  const declaredKeeperCost = declaredKeepers.reduce((total, keeper) => total + keeper.newCost, 0);
  const remainingCounts = mapPositionAmounts(position => Math.max(0, keeperCounts[position] - declaredCounts[position]));
  const totalKeeperCost = definition.averageKeeperCosts === undefined
    ? declaredKeeperCost
    : declaredKeeperCost + totalAverageKeeperCost(remainingCounts, definition.averageKeeperCosts);
  const openAuctionDollars = config.leagueTotalBudget - totalKeeperCost;
  const globalFactor = openAuctionDollars / config.historicalOpenAuctionSpendBaseline;
  return {
    key: definition.key,
    label: definition.label,
    includedKeeperStatuses: definition.includedKeeperStatuses,
    keeperCounts,
    totalKeeperCost,
    openAuctionDollars,
    globalFactor,
    positionFactors: positionFactorsFor(keeperCounts, globalFactor, config),
  };
});

export const applyKeeperScenarioToPrices = (
  prices: readonly BasePrice[],
  scenario: KeeperScenario,
  keepers: readonly KeeperDeclaration[],
): AppliedKeeperScenario => {
  const unavailableKeepers = declaredKeepersFor(keepers, scenario.includedKeeperStatuses);
  const unavailableNames = new Set(unavailableKeepers.map(keeper => normalizePlayerName(keeper.player)));
  const availablePrices = prices.filter(price => !unavailableNames.has(price.normalizedName)).map(price => {
    const scenarioFactor = scenario.positionFactors[price.position];
    return { ...price, scenarioFactor, scenarioPrice: Math.max(1, Math.round(price.price * scenarioFactor)) };
  }).sort((left, right) => right.scenarioPrice - left.scenarioPrice
    || right.price - left.price || left.name.localeCompare(right.name));
  return { scenario, unavailableKeepers, availablePrices };
};
