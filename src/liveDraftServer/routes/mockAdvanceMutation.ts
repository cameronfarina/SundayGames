import type { Owner } from "../../../config/league.js";
import type { LiveDraftStrategyKey } from "../../modeling/liveDraftStrategies.js";
import { loadInteractiveMockDraftModule } from "../interactiveMockModule.js";
import {
  mockAuctionOpeningBidFromValue,
  mockAuctionPlayerFromValue,
  mockDraftFromInteractiveMockAction,
  mockDraftRequestFor,
  mockDraftWithClientAuction,
  optionalCommandFromInteractiveMockAction,
} from "../mockState.js";
import type { RouteContext } from "../runtimeContracts.js";

interface AdvanceMockDraftInput {
  action: string;
  context: RouteContext;
  draftSessionKey: string;
  mockAuction: unknown | undefined;
  nominatedPlayer: string | undefined;
  nominatedPrice: number | undefined;
  seed: string | undefined;
  strategyKey: LiveDraftStrategyKey;
  watchOwner: Owner;
}

export const advanceMockDraft = async ({
  action,
  context,
  draftSessionKey,
  mockAuction,
  nominatedPlayer,
  nominatedPrice,
  seed,
  strategyKey,
  watchOwner,
}: AdvanceMockDraftInput) => context.stores.runQueuedMutation(
  draftSessionKey,
  "interactive-mock",
  async () => {
    const module = await loadInteractiveMockDraftModule(context.options.interactiveMockDraft);
    const store = await context.stores.storeFor(draftSessionKey, "interactive-mock");
    const restoredPlayer = nominatedPlayer ?? mockAuctionPlayerFromValue(mockAuction);
    const restoredPrice = nominatedPrice ?? mockAuctionOpeningBidFromValue(mockAuction);
    const mockDraft = mockDraftWithClientAuction(
      await context.interactive.mockDraftFor({
        ...mockDraftRequestFor(strategyKey, seed, restoredPlayer, restoredPrice),
        draftSessionKey,
        watchOwner,
      }),
      mockAuction,
    );
    const actionResult = module.resolveInteractiveMockDraftAction(mockDraft, action);
    const unresolved = mockDraftFromInteractiveMockAction(actionResult);
    const command = optionalCommandFromInteractiveMockAction(actionResult);
    if (command === undefined) {
      return {
        status: 200,
        body: {
          ...await context.state.stateFor({
            draftSessionKey,
            mode: "interactive-mock",
            strategyKey,
            watchOwner,
          }),
          mockDraft: unresolved ?? mockDraft,
        },
      };
    }
    const trialCommands = [...store.currentCommands(), command];
    const trialState = await context.state.stateFor({
      draftSessionKey,
      mode: "interactive-mock",
      commands: trialCommands,
      strategyKey,
      watchOwner,
    });
    const commandError = trialState.errors.find(error => error.input === command);
    if (commandError !== undefined) {
      return {
        status: 422,
        body: {
          ...await context.interactive.stateWithMockDraft({
            ...mockDraftRequestFor(strategyKey, seed, nominatedPlayer, nominatedPrice),
            draftSessionKey,
            watchOwner,
          }),
          errors: [commandError],
        },
      };
    }
    await store.appendCommand(command);
    return {
      status: 200,
      body: await context.interactive.stateWithMockDraft({
        ...mockDraftRequestFor(strategyKey, seed),
        draftSessionKey,
        watchOwner,
      }),
    };
  },
);
