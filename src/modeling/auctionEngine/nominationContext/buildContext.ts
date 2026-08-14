import { positions } from "../../../../config/league.js";
import type { Player } from "../../../types.js";
import type { AuctionOwnerState } from "../auctionContracts.js";
import type { AuctionEngineConfig } from "../configContracts.js";
import { emptyPositionAmounts } from "../constants.js";
import { positionCapacityFor } from "../demand.js";
import type { NominationContext } from "../nominationTypes.js";
import { countPositions } from "../ownerStates.js";
import { canOwnerCompleteRosterAfterAddingPositionSlots } from "../rosterRules.js";
import { nominationNeedScoreForCounts } from "./need.js";
import { directShortageAfterPickFor, emptyPositionBooleans } from "./positionState.js";

export const buildNominationContext = (
  availablePlayers: readonly Player[],
  ownerStates: readonly AuctionOwnerState[],
  config: AuctionEngineConfig,
): NominationContext => {
  const availablePositionCounts = countPositions(availablePlayers);
  const ownerCounts = new Map(ownerStates.map(state => [state.owner, countPositions(state.roster)]));
  const ownersNeedingPosition = emptyPositionAmounts();
  const ownerContexts = ownerStates.map(state => {
    const counts = ownerCounts.get(state.owner);
    if (!counts) throw new Error(`Missing nomination counts for ${state.owner}.`);

    const canCompleteAfterAdding = emptyPositionBooleans();
    const directShortageAfterPick = emptyPositionAmounts();
    const needScore = emptyPositionAmounts();
    const capacity = emptyPositionAmounts();

    for (const position of positions) {
      canCompleteAfterAdding[position] = canOwnerCompleteRosterAfterAddingPositionSlots(
        state,
        position,
        1,
        config,
      );
      directShortageAfterPick[position] = directShortageAfterPickFor(
        state.owner,
        position,
        ownerCounts,
        config,
      );
      needScore[position] = nominationNeedScoreForCounts(state.owner, counts, position, config);
      capacity[position] = positionCapacityFor(state, position, config);
      if (needScore[position] > 0) ownersNeedingPosition[position] += 1;
    }

    return {
      state,
      canCompleteAfterAdding,
      directShortageAfterPick,
      needScore,
      capacity,
    };
  });

  return {
    availablePositionCounts,
    ownerContexts,
    ownerContextByOwner: new Map(ownerContexts.map(context => [context.state.owner, context])),
    ownersNeedingPosition,
  };
};
