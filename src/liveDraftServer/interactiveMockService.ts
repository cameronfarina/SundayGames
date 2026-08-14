import { primaryOwner } from "../../config/league.js";
import type { CreateLiveDraftServerOptions } from "./contracts.js";
import { defaultLiveDraftSessionKey } from "./constants.js";
import { advanceMockAction } from "./advanceMockAction.js";
import { completeMockAction } from "./completeMockAction.js";
import { createInteractiveBatchForCommands } from "./interactiveBatch.js";
import { loadInteractiveMockDraftModule } from "./interactiveMockModule.js";
import { createMockDraftStateService } from "./mockDraftStateService.js";
import type {
  BatchService,
  InteractiveMockService,
  LiveDraftData,
  StoreService,
  StateService,
} from "./runtimeContracts.js";

export const createInteractiveMockService = ({
  data,
  options,
  stores,
  state,
  batches,
}: {
  data: LiveDraftData;
  options: CreateLiveDraftServerOptions;
  stores: StoreService;
  state: StateService;
  batches: BatchService;
}): InteractiveMockService => {
  const draftState = createMockDraftStateService({ data, options, stores, state });
  const interactiveBatchForCommands = createInteractiveBatchForCommands({ data, options, state });
  const runSpeedAction: InteractiveMockService["runSpeedAction"] = async request => {
    const module = await loadInteractiveMockDraftModule(options.interactiveMockDraft);
    const store = await stores.storeFor(
      request.draftSessionKey ?? defaultLiveDraftSessionKey,
      "interactive-mock",
    );
    const required = {
      ...request,
      draftSessionKey: request.draftSessionKey ?? defaultLiveDraftSessionKey,
      watchOwner: request.watchOwner ?? primaryOwner,
    };
    if (request.action === "complete-mock") {
      return completeMockAction(
        { data, stores, state, batches, ...draftState, module },
        required,
      );
    }
    return advanceMockAction(
      { module, store, state, ...draftState },
      required,
    );
  };
  return {
    ...draftState,
    runSpeedAction,
    interactiveBatchForCommands,
  };
};
