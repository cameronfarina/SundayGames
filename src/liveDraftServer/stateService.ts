import { parseLiveDraftStrategyKey, type LiveDraftStrategyKey } from "../modeling/liveDraftStrategies.js";
import type { CreateLiveDraftServerOptions } from "./contracts.js";
import type { BatchService, LiveDraftData, StateService, StoreService } from "./runtimeContracts.js";
import { createStateAdvice } from "./stateAdvice.js";
import { createStateFor } from "./stateCore.js";

export const createStateService = ({
  data,
  options,
  stores,
  batches,
  enabledDraftSessionKeyFromQuery,
}: {
  data: LiveDraftData;
  options: CreateLiveDraftServerOptions;
  stores: StoreService;
  batches: BatchService;
  enabledDraftSessionKeyFromQuery(url: URL): string;
}): StateService => {
  const stateFor = createStateFor({ data, stores, batches });
  const strategyKeyFromQuery = (url: URL): LiveDraftStrategyKey =>
    parseLiveDraftStrategyKey(url.searchParams.get("strategy") ?? undefined);
  return {
    stateFor,
    ...createStateAdvice({
      data,
      options,
      stores,
      stateFor,
      enabledDraftSessionKeyFromQuery,
      strategyKeyFromQuery,
    }),
  };
};
