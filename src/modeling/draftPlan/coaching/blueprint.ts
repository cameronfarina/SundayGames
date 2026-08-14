import type { PlayerBatchSummary } from "../../mockBatch.js";
import type {
  DraftPlanCandidate,
  DraftPlanPlayer,
  DraftPlanSlotBlueprint,
  DraftPlanStrategyDefinition,
} from "../contracts.js";
import { priceBandText, priceWindowText } from "../formatters.js";
import type { CoachSlotDefinition } from "../internalContracts.js";
import { average, roundToTwo } from "../numbers.js";
import { fallbackNamesForBlueprint } from "./fallbackNames.js";
import { fallbackWindowForBlueprint } from "./fallbackWindow.js";
import { lockedNamesForBlueprint, targetNamesForBlueprint } from "./names.js";

const presentPlayer = (player: DraftPlanPlayer | undefined): player is DraftPlanPlayer =>
  player !== undefined;

export const slotBlueprintFor = (
  definition: CoachSlotDefinition,
  candidates: readonly DraftPlanCandidate[],
  marketPlayers: readonly PlayerBatchSummary[],
  strategy: DraftPlanStrategyDefinition,
): DraftPlanSlotBlueprint | undefined => {
  const players = candidates.map(definition.playerForCandidate).filter(presentPlayer);
  if (players.length === 0) return undefined;

  const prices = players.map(player => player.price);
  const minimumPrice = Math.min(...prices);
  const maximumPrice = Math.max(...prices);
  const averagePrice = average(prices);
  const lockedNames = lockedNamesForBlueprint(players, candidates.length);
  const targetNames = targetNamesForBlueprint(players, lockedNames);
  const fallbackWindow = fallbackWindowForBlueprint(
    definition,
    minimumPrice,
    maximumPrice,
    averagePrice,
    strategy,
  );

  return {
    slot: definition.slot,
    position: definition.position,
    sampleCount: players.length,
    minimumPrice,
    maximumPrice,
    averagePrice: roundToTwo(averagePrice),
    priceBand: priceWindowText(minimumPrice, maximumPrice),
    lockedNames,
    targetNames,
    fallbackPriceBand: priceBandText(fallbackWindow),
    fallbackNames: fallbackNamesForBlueprint({
      definition,
      marketPlayers,
      window: fallbackWindow,
      lockedNames,
      targetNames,
    }),
    note: definition.note,
  };
};
