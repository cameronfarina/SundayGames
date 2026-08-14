import { primaryOwner } from "../../config/league.js";
import { defaultLiveDraftSessionKey } from "./constants.js";
import type { CreateLiveDraftServerOptions } from "./contracts.js";
import { loadInteractiveMockDraftModule } from "./interactiveMockModule.js";
import { mockDraftRequestFor } from "./mockState.js";
import type {
  LiveDraftData,
  MockDraftRequest,
  StateService,
  StoreService,
} from "./runtimeContracts.js";

export const createMockDraftStateService = ({
  data,
  options,
  stores,
  state,
}: {
  data: LiveDraftData;
  options: CreateLiveDraftServerOptions;
  stores: StoreService;
  state: StateService;
}): {
  mockDraftFor(request: MockDraftRequest): Promise<unknown>;
  stateWithMockDraft(request: MockDraftRequest): Promise<import("./contracts.js").LiveDraftStateResponse & { mockDraft: unknown }>;
} => {
  const mockDraftFor = async ({
    draftSessionKey = defaultLiveDraftSessionKey,
    watchOwner = primaryOwner,
    commands,
    strategyKey,
    seed,
    nominatedPlayer,
    nominatedPrice,
  }: MockDraftRequest): Promise<unknown> => {
    const interactive = await loadInteractiveMockDraftModule(options.interactiveMockDraft);
    const store = await stores.storeFor(draftSessionKey, "interactive-mock");
    return interactive.buildInteractiveMockDraftState({
      projections: data.projections,
      historicalRecords: data.historicalRecords,
      keepers: data.configuredKeepers,
      commands: commands ?? store.currentCommands(),
      watchOwner,
      strategyKey,
      pricingConfig: data.pricingConfig,
      draftRoomRankings: data.draftRoomRankings,
      ...(seed === undefined ? {} : { seed }),
      ...(nominatedPlayer === undefined ? {} : { nominatedPlayer }),
      ...(nominatedPrice === undefined ? {} : { nominatedPrice }),
    });
  };

  const stateWithMockDraft = async ({
    draftSessionKey = defaultLiveDraftSessionKey,
    watchOwner = primaryOwner,
    strategyKey,
    seed,
    nominatedPlayer,
    nominatedPrice,
  }: MockDraftRequest) => {
    const store = await stores.storeFor(draftSessionKey, "interactive-mock");
    const commands = store.currentCommands();
    return {
      ...await state.stateFor({ draftSessionKey, mode: "interactive-mock", commands, strategyKey, watchOwner }),
      mockDraft: await mockDraftFor({
        ...mockDraftRequestFor(strategyKey, seed, nominatedPlayer, nominatedPrice),
        draftSessionKey,
        watchOwner,
        commands,
      }),
    };
  };
  return { mockDraftFor, stateWithMockDraft };
};
