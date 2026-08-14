import { primaryOwner } from "../../../config/league.js";
import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type {
  BuildAroundStrategyLabScenarioOptions,
  StrategyLabScenario,
} from "./scenarioContracts.js";

const minimumBid = 1;

const scenarioKeyPartFor = (value: string): string =>
  normalizePlayerName(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const validatePrices = (prices: readonly number[]): number[] => {
  const uniquePrices = [...new Set(prices)];
  if (uniquePrices.length === 0) {
    throw new Error("Build-around scenarios require at least one price.");
  }
  const invalidPrice = uniquePrices.find(price => !Number.isInteger(price) || price < minimumBid);
  if (invalidPrice !== undefined) {
    throw new Error(`Invalid build-around price "${invalidPrice}".`);
  }
  return uniquePrices;
};

export const buildAroundStrategyLabScenarios = ({
  player,
  prices,
  strategyKey,
  baseForcedSales = [],
  targetMaxBids = [],
}: BuildAroundStrategyLabScenarioOptions): StrategyLabScenario[] => {
  const trimmedPlayer = player.trim();
  if (!trimmedPlayer) throw new Error("Build-around player is required.");

  const normalizedPlayer = normalizePlayerName(trimmedPlayer);
  const conflicts = baseForcedSales.some(
    sale => normalizePlayerName(sale.player) === normalizedPlayer,
  );
  if (conflicts) {
    throw new Error(`Build-around player "${trimmedPlayer}" is already forced in the base path.`);
  }

  const keyPlayerPart = scenarioKeyPartFor(trimmedPlayer);
  return validatePrices(prices).map(price => ({
    key: `build-around-${keyPlayerPart}-${price}`,
    label: `Build around ${trimmedPlayer} $${price}`,
    question: `If the primary team builds around ${trimmedPlayer} at $${price}, what does the rest of the roster become?`,
    strategyKey,
    forcedSales: [
      ...baseForcedSales,
      { owner: primaryOwner, player: trimmedPlayer, price },
    ],
    targetMaxBids: [...targetMaxBids],
    notes: "Build-around sweep: compare the same anchor at different price points.",
  }));
};
