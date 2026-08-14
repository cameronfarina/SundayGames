import type {
  DraftPlanPriceBand,
  DraftPlanStrategyDefinition,
} from "../contracts.js";
import type { CoachSlotDefinition, CoachSlotKey } from "../internalContracts.js";
import { strategyPlanRules } from "../strategyPlanRules.js";

const fallbackWindowCushion = 8;
const minimumFallbackPrice = 1;

const pathBandForSlot = (
  slot: CoachSlotKey,
  strategy: DraftPlanStrategyDefinition,
): DraftPlanPriceBand | undefined =>
  strategyPlanRules[strategy.key].priceBands.find(band => band.slot === slot);

export const fallbackWindowForBlueprint = (
  definition: CoachSlotDefinition,
  minimumPrice: number,
  maximumPrice: number,
  averagePrice: number,
  strategy: DraftPlanStrategyDefinition,
): Pick<DraftPlanPriceBand, "minimumPrice" | "maximumPrice"> => {
  const pathBand = pathBandForSlot(definition.slot, strategy);
  const minimum = Math.max(
    minimumFallbackPrice,
    Math.min(minimumPrice, Math.floor(averagePrice - fallbackWindowCushion)),
  );
  const uncappedMaximum = Math.max(maximumPrice, Math.ceil(averagePrice + fallbackWindowCushion));
  const maximum = pathBand
    ? Math.min(pathBand.maximumPrice, uncappedMaximum)
    : uncappedMaximum;
  return {
    minimumPrice: minimum,
    maximumPrice: Math.max(minimum, maximum),
  };
};
