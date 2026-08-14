import type { CliArguments } from "../arguments.js";

export interface StrategyLabPlayerPrice {
  player: string;
  price: number;
}

export const strategyLabPlayerPrices = (
  arguments_: CliArguments,
  optionName: "--force" | "--target",
): StrategyLabPlayerPrice[] | undefined => {
  const values = arguments_.options(optionName);
  if (values.length === 0) return undefined;

  return values.flatMap(value => value.split(",")).map(rawEntry => {
    const separatorIndex = rawEntry.lastIndexOf(":");
    if (separatorIndex <= 0 || separatorIndex === rawEntry.length - 1) {
      throw new Error(`Invalid ${optionName} entry "${rawEntry}". Use Player Name:price.`);
    }

    const player = rawEntry.slice(0, separatorIndex).trim();
    const price = Number(rawEntry.slice(separatorIndex + 1).trim().replace(/^\$/, ""));
    if (!player || !Number.isInteger(price) || price < 1) {
      throw new Error(`Invalid ${optionName} entry "${rawEntry}". Use Player Name:price.`);
    }
    return { player, price };
  });
};

export const buildAroundPrices = (priceSpec: string): number[] => {
  const [rangeText, stepText] = priceSpec.split(":");
  if (!rangeText) throw new Error("Build-around price list is required.");
  if (!rangeText.includes("-")) {
    const prices = rangeText.split(",").map(priceText => Number(priceText.trim()));
    if (prices.some(price => !Number.isInteger(price) || price < 1)) {
      throw new Error(`Invalid build-around prices "${priceSpec}". Use 46,48,50 or 46-52:2.`);
    }
    return prices;
  }

  const [minimumText, maximumText] = rangeText.split("-");
  const minimum = Number(minimumText);
  const maximum = Number(maximumText);
  const step = stepText === undefined ? 1 : Number(stepText);
  if (!Number.isInteger(minimum) || !Number.isInteger(maximum) ||
      !Number.isInteger(step) || minimum < 1 || maximum < minimum || step < 1) {
    throw new Error(`Invalid build-around range "${priceSpec}". Use min-max[:step], for example 46-52:2.`);
  }

  const prices: number[] = [];
  for (let price = minimum; price <= maximum; price += step) prices.push(price);
  return prices;
};
