import type {
  BatchService,
  InteractiveMockService,
  LiveDraftData,
  MockDraftRequest,
  StateService,
  StoreService,
} from "../runtimeContracts.js";
import type { InteractiveMockDraftModule } from "../contracts.js";

export interface CompleteContext {
  data: LiveDraftData;
  stores: StoreService;
  state: StateService;
  batches: BatchService;
  mockDraftFor: InteractiveMockService["mockDraftFor"];
  stateWithMockDraft: InteractiveMockService["stateWithMockDraft"];
  module: InteractiveMockDraftModule;
}

export type CompleteMockRequest = Required<
  Pick<MockDraftRequest, "draftSessionKey" | "watchOwner" | "strategyKey">
> & Omit<MockDraftRequest, "draftSessionKey" | "watchOwner" | "strategyKey">;
