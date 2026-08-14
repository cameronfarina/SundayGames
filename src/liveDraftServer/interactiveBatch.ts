import { strategyAuctionOverridesFor } from "../modeling/interactiveMockDraft.js";
import { runMockBatch, type ForcedAuctionSale, type MockBatch } from "../modeling/mockBatch.js";
import type { CreateLiveDraftServerOptions } from "./contracts.js";
import type { LiveDraftData, StateService } from "./runtimeContracts.js";

export const createInteractiveBatchForCommands = ({
  data,
  options,
  state,
}: {
  data: LiveDraftData;
  options: CreateLiveDraftServerOptions;
  state: StateService;
}) => async ({
  draftSessionKey,
  watchOwner,
  strategyKey,
  commands,
  seed,
}: {
  draftSessionKey: string;
  watchOwner: import("../../config/league.js").Owner;
  strategyKey: import("../modeling/liveDraftStrategies.js").LiveDraftStrategyKey;
  commands: readonly string[];
  seed?: string;
}): Promise<MockBatch> => {
  const currentState = await state.stateFor({
    draftSessionKey,
    mode: "interactive-mock",
    commands,
    strategyKey,
    watchOwner,
  });
  if (currentState.errors.length) {
    throw new Error(currentState.errors.map(error => error.message).join("\n"));
  }
  const forcedSales: ForcedAuctionSale[] = currentState.events.map(event => ({
    owner: event.owner,
    player: event.player,
    price: event.price,
  }));
  const completeSeed = seed ?? `interactive-session-results:${draftSessionKey}:${commands.length}`;
  const batchRunner = options.mockBatchRunner ?? runMockBatch;
  return batchRunner({
    projections: data.projections,
    historicalRecords: data.historicalRecords,
    keepers: data.configuredKeepers,
    scenarioKeys: ["expected"],
    runsPerScenario: 1,
    seedPrefix: completeSeed,
    pricingConfig: data.pricingConfig,
    auctionConfigOverrides: strategyAuctionOverridesFor(
      watchOwner,
      strategyKey,
      { variantSeed: completeSeed },
    ),
    forcedSales,
    diagnosticsMode: "summary",
  });
};
