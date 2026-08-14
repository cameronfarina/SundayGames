import type {
  PlayerPriceWaterfallStep,
  PlayerPriceWaterfallStepKey,
} from "./contracts/waterfall.js";
import { roundNullableToTwo, roundToTwo } from "./math.js";

export const waterfallStep = (
  key: PlayerPriceWaterfallStepKey,
  label: string,
  inputAmount: number | null,
  outputAmount: number | null,
  note: string,
  factor?: number,
): PlayerPriceWaterfallStep => ({
  key,
  label,
  inputAmount: roundNullableToTwo(inputAmount),
  outputAmount: roundNullableToTwo(outputAmount),
  delta: inputAmount === null || outputAmount === null
    ? null
    : roundToTwo(roundToTwo(outputAmount) - roundToTwo(inputAmount)),
  ...(factor === undefined ? {} : { factor: roundToTwo(factor) }),
  note,
});
