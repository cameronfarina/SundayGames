import { keepers as defaultKeepers } from "../../../config/keepers.js";
import { defaultPricingConfig } from "../basePricing.js";
import { defaultLiveDraftStrategyKey } from "../liveDraftStrategies.js";
import { aiNominationStateFor } from "./aiNominationState.js";
import { baseStateFor } from "./baseState.js";
import type {
  BuildInteractiveMockDraftStateOptions,
  InteractiveMockDraftState,
} from "./contracts.js";
import {
  defaultScenarioKey,
  defaultSeed,
  defaultWatchOwner,
} from "./defaults.js";
import {
  allRostersFull,
  snakeOwnerForPick,
} from "./draftStateQueries.js";
import { humanNominationStateFor } from "./humanNominationState.js";
import { prepareInteractiveMockDraft } from "./preparation.js";

export const buildInteractiveMockDraftState = ({
  projections,
  historicalRecords,
  keepers = defaultKeepers,
  scenarioKey = defaultScenarioKey,
  strategyKey = defaultLiveDraftStrategyKey,
  watchOwner = defaultWatchOwner,
  commands = [],
  pricingConfig = defaultPricingConfig,
  seed = defaultSeed,
  nominatedPlayer,
  nominatedPrice,
  draftRoomRankings = [],
  diagnosticsMode = "full",
}: BuildInteractiveMockDraftStateOptions): InteractiveMockDraftState => {
  const prepared = prepareInteractiveMockDraft({
    projections,
    historicalRecords,
    keepers,
    scenarioKey,
    strategyKey,
    watchOwner,
    commands,
    pricingConfig,
    seed,
    draftRoomRankings,
  });
  const pickIndex = prepared.liveState.events.length;
  const nominationTurn = snakeOwnerForPick(pickIndex, prepared.ownerStates);

  if (prepared.liveState.errors.length > 0) {
    return baseStateFor({
      phase: "blocked",
      prepared,
      watchOwner,
      seed,
      pickNumber: pickIndex + 1,
      nominationCursor: pickIndex,
      message: prepared.liveState.errors[0]?.message
        ?? "Resolve command errors before continuing mock draft.",
    });
  }
  if (
    prepared.auctionPlayers.length === 0
    || allRostersFull(prepared.ownerStates)
    || !nominationTurn
  ) {
    return baseStateFor({
      phase: "complete",
      prepared,
      watchOwner,
      seed,
      pickNumber: pickIndex + 1,
      nominationCursor: pickIndex,
      message: "All roster slots are filled.",
    });
  }
  if (nominationTurn.owner === watchOwner) {
    return humanNominationStateFor({
      prepared,
      watchOwner,
      seed,
      pickIndex,
      nominationCursor: nominationTurn.cursor,
      ...(nominatedPlayer === undefined ? {} : { nominatedPlayer }),
      ...(nominatedPrice === undefined ? {} : { nominatedPrice }),
      diagnosticsMode,
    });
  }
  return aiNominationStateFor({
    prepared,
    watchOwner,
    seed,
    pickIndex,
    nominationCursor: nominationTurn.cursor,
    nominator: nominationTurn.owner,
    diagnosticsMode,
  });
};
