import { strategyAuctionOverridesFor } from "../modeling/interactiveMockDraft.js";
import { runMockBatch, type ForcedAuctionSale, type MockBatch } from "../modeling/mockBatch.js";
import type { BatchService, InteractiveMockService, LiveDraftData, MockDraftRequest, StateService, StoreService } from "./runtimeContracts.js";
import type { InteractiveMockDraftModule } from "./contracts.js";
import { commandForMockAction } from "./mockActionCommand.js";
import {
  mockDraftPhaseFor,
  mockDraftRequestFor,
  mockDraftTopTargetNameFor,
} from "./mockState.js";

interface CompleteContext {
  data: LiveDraftData;
  stores: StoreService;
  state: StateService;
  batches: BatchService;
  mockDraftFor: InteractiveMockService["mockDraftFor"];
  stateWithMockDraft: InteractiveMockService["stateWithMockDraft"];
  module: InteractiveMockDraftModule;
}

const errorBody = async (
  context: CompleteContext,
  request: MockDraftRequest,
  message: string,
) => ({
  ...await context.stateWithMockDraft(request),
  errors: [{ input: "", message }],
});

const visibleAuctionCommandFor = async (
  context: CompleteContext,
  request: MockDraftRequest,
  commands: readonly string[],
): Promise<string | undefined> => {
  const mockDraft = await context.mockDraftFor({ ...request, commands });
  const phase = mockDraftPhaseFor(mockDraft);
  if (phase === "ai-sale") return commandForMockAction(context.module, mockDraft, "advance");
  if (phase === "human-decision") return commandForMockAction(context.module, mockDraft, "cam-bid");
  if (phase === "blocked") throw new Error("Mock draft is blocked and cannot be completed.");
  if (phase !== "human-nomination") return undefined;
  const automaticNomination = request.nominatedPlayer ?? mockDraftTopTargetNameFor(mockDraft);
  if (!automaticNomination) return undefined;
  const nominated = await context.mockDraftFor({
    ...request,
    commands,
    nominatedPlayer: automaticNomination,
  });
  return commandForMockAction(
    context.module,
    nominated,
    mockDraftPhaseFor(nominated) === "human-decision" ? "cam-bid" : "advance",
  );
};

export const completeMockAction = async (
  context: CompleteContext,
  request: Required<Pick<MockDraftRequest, "draftSessionKey" | "watchOwner" | "strategyKey">> &
    Omit<MockDraftRequest, "draftSessionKey" | "watchOwner" | "strategyKey">,
) => {
  const currentState = await context.state.stateFor({
    draftSessionKey: request.draftSessionKey,
    mode: "interactive-mock",
    strategyKey: request.strategyKey,
    watchOwner: request.watchOwner,
  });
  if (currentState.errors.length) {
    return { status: 422, body: { ...await context.stateWithMockDraft(request), errors: currentState.errors } };
  }
  const store = await context.stores.storeFor(request.draftSessionKey, "interactive-mock");
  let baseCommands = [...store.currentCommands()];
  try {
    const visibleCommand = await visibleAuctionCommandFor(context, request, baseCommands);
    if (visibleCommand) {
      const trialCommands = [...baseCommands, visibleCommand];
      const trial = await context.state.stateFor({
        draftSessionKey: request.draftSessionKey,
        mode: "interactive-mock",
        commands: trialCommands,
        strategyKey: request.strategyKey,
        watchOwner: request.watchOwner,
      });
      const error = trial.errors.find(item => item.input === visibleCommand);
      if (error) return { status: 422, body: { ...await context.stateWithMockDraft(request), errors: [error] } };
      baseCommands = trialCommands;
    }
  } catch (error) {
    return {
      status: 422,
      body: await errorBody(
        context,
        request,
        error instanceof Error ? error.message : "Could not complete mock draft.",
      ),
    };
  }

  const baseState = await context.state.stateFor({
    draftSessionKey: request.draftSessionKey,
    mode: "interactive-mock",
    commands: baseCommands,
    strategyKey: request.strategyKey,
    watchOwner: request.watchOwner,
  });
  const forcedSales: ForcedAuctionSale[] = baseState.events.map(event => ({
    owner: event.owner,
    player: event.player,
    price: event.price,
  }));
  const completeSeed = request.seed ??
    `interactive-complete:${request.draftSessionKey}:${baseState.events.length}`;
  let batch: MockBatch;
  try {
    batch = runMockBatch({
      projections: context.data.projections,
      historicalRecords: context.data.historicalRecords,
      keepers: context.data.configuredKeepers,
      scenarioKeys: ["expected"],
      runsPerScenario: 1,
      seedPrefix: completeSeed,
      pricingConfig: context.data.pricingConfig,
      auctionConfigOverrides: strategyAuctionOverridesFor(
        request.watchOwner,
        request.strategyKey,
        { variantSeed: completeSeed },
      ),
      forcedSales,
      diagnosticsMode: "summary",
    });
  } catch (error) {
    return {
      status: 422,
      body: await errorBody(context, request, error instanceof Error ? error.message : "Could not complete mock draft."),
    };
  }
  const run = batch.runs[0];
  if (!run) return { status: 422, body: await errorBody(context, request, "Mock draft completion did not produce a run.") };
  const completedCommands = [
    ...baseCommands,
    ...run.picks.map(pick => `${pick.owner} drafted ${pick.player} for ${pick.price}`),
  ];
  const completedState = await context.state.stateFor({
    draftSessionKey: request.draftSessionKey,
    mode: "interactive-mock",
    commands: completedCommands,
    strategyKey: request.strategyKey,
    watchOwner: request.watchOwner,
  });
  if (completedState.errors.length) {
    return { status: 422, body: { ...await context.stateWithMockDraft(request), errors: completedState.errors } };
  }
  await store.importCommands(completedCommands);
  const job = context.batches.publishInteractiveResults({
    draftSessionKey: request.draftSessionKey,
    watchOwner: request.watchOwner,
    strategyKey: request.strategyKey,
    commandCount: completedCommands.length,
    batch,
  });
  return {
    status: 200,
    body: {
      ...await context.stateWithMockDraft({ ...mockDraftRequestFor(request.strategyKey, request.seed), draftSessionKey: request.draftSessionKey, watchOwner: request.watchOwner }),
      mockBatchJob: context.batches.responseFor(job),
    },
  };
};
