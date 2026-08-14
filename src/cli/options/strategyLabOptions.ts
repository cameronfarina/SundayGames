import { primaryOwner } from "../../../config/league.js";
import type { ForcedAuctionSale } from "../../modeling/mockBatch.js";
import {
  buildAroundStrategyLabScenarios,
  type StrategyLabScenario,
  type StrategyLabTargetMaxBid,
} from "../../modeling/strategyLab.js";
import type { LiveDraftStrategyKey } from "../../modeling/liveDraftStrategies.js";
import type { CliArguments } from "../arguments.js";
import { buildAroundPrices, strategyLabPlayerPrices } from "./strategyLabPrices.js";

const strategyOption = (arguments_: CliArguments): LiveDraftStrategyKey => {
  const value = arguments_.option("--strategy") ?? "balanced";
  if (value === "balanced" || value === "three-rb" ||
      value === "hero-rb" || value === "wr-heavy") return value;
  throw new Error(`Unknown strategy lab strategy "${value}". Use balanced, three-rb, hero-rb, or wr-heavy.`);
};

const forcedSales = (arguments_: CliArguments): ForcedAuctionSale[] =>
  (strategyLabPlayerPrices(arguments_, "--force") ?? [])
    .map(({ player, price }) => ({ owner: primaryOwner, player, price }));

const targetMaxBids = (arguments_: CliArguments): StrategyLabTargetMaxBid[] =>
  (strategyLabPlayerPrices(arguments_, "--target") ?? [])
    .map(({ player, price }) => ({ owner: primaryOwner, player, maxBid: price }));

const buildAroundEntries = (arguments_: CliArguments) =>
  arguments_.options("--build-around").map(rawEntry => {
    const separatorIndex = rawEntry.indexOf(":");
    if (separatorIndex <= 0 || separatorIndex === rawEntry.length - 1) {
      throw new Error(`Invalid --build-around entry "${rawEntry}". Use Player Name:price,price or Player Name:min-max:step.`);
    }
    const player = rawEntry.slice(0, separatorIndex).trim();
    const priceSpec = rawEntry.slice(separatorIndex + 1).trim().replace(/\$/g, "");
    if (!player || !priceSpec) {
      throw new Error(`Invalid --build-around entry "${rawEntry}". Use Player Name:price,price or Player Name:min-max:step.`);
    }
    return { player, prices: buildAroundPrices(priceSpec) };
  });

export const strategyLabScenariosOption = (
  arguments_: CliArguments,
): StrategyLabScenario[] | undefined => {
  const sales = forcedSales(arguments_);
  const targets = targetMaxBids(arguments_);
  const buildAround = buildAroundEntries(arguments_);
  if (buildAround.length > 0) {
    return buildAround.flatMap(entry => buildAroundStrategyLabScenarios({
      player: entry.player,
      prices: entry.prices,
      strategyKey: strategyOption(arguments_),
      baseForcedSales: sales,
      targetMaxBids: targets,
    }));
  }
  if (sales.length === 0 && targets.length === 0) return undefined;
  return [{
    key: "custom",
    label: arguments_.option("--label") ?? "Custom",
    question: "Custom primary-team strategy-lab path.",
    strategyKey: strategyOption(arguments_),
    forcedSales: sales,
    targetMaxBids: targets,
  }];
};
