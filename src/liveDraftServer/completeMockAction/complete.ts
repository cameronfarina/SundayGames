import { strategyAuctionOverridesFor } from "../../modeling/interactiveMockDraft.js";
import { runMockBatch, type ForcedAuctionSale, type MockBatch } from "../../modeling/mockBatch.js";
import { mockDraftRequestFor } from "../mockState.js";
import type { StateRequest } from "../runtimeContracts.js";
import type { CompleteContext, CompleteMockRequest } from "./contracts.js";
import { visibleAuctionCommandFor } from "./visibleCommand.js";

const errorBody = async (
  context: CompleteContext,
  request: CompleteMockRequest,
  message: string,
) => ({
  ...await context.stateWithMockDraft(request),
  errors: [{ input: "", message }],
});

const stateRequestFor = (
  request: CompleteMockRequest,
  commands?: readonly string[],
): StateRequest => {
  const baseRequest: StateRequest = {
    draftSessionKey: request.draftSessionKey,
    mode: "interactive-mock",
    strategyKey: request.strategyKey,
    watchOwner: request.watchOwner,
  };
  return commands === undefined ? baseRequest : { ...baseRequest, commands };
};

const completionBatch = (
  context: CompleteContext,
  request: CompleteMockRequest,
  forcedSales: readonly ForcedAuctionSale[],
  seed: string,
): MockBatch => runMockBatch({
  projections: context.data.projections,
  historicalRecords: context.data.historicalRecords,
  keepers: context.data.configuredKeepers,
  scenarioKeys: ["expected"],
  runsPerScenario: 1,
  seedPrefix: seed,
  pricingConfig: context.data.pricingConfig,
  auctionConfigOverrides: strategyAuctionOverridesFor(
    request.watchOwner,
    request.strategyKey,
    { variantSeed: seed },
  ),
  forcedSales,
  diagnosticsMode: "summary",
});

export const completeMockAction = async (
  context: CompleteContext,
  request: CompleteMockRequest,
) => {
  const currentState = await context.state.stateFor(stateRequestFor(request));
  if (currentState.errors.length) {
    return {
      status: 422,
      body: { ...await context.stateWithMockDraft(request), errors: currentState.errors },
    };
  }
  const store = await context.stores.storeFor(request.draftSessionKey, "interactive-mock");
  let baseCommands = [...store.currentCommands()];
  try {
    const visibleCommand = await visibleAuctionCommandFor(context, request, baseCommands);
    if (visibleCommand) {
      const trialCommands = [...baseCommands, visibleCommand];
      const trial = await context.state.stateFor(stateRequestFor(request, trialCommands));
      const error = trial.errors.find(item => item.input === visibleCommand);
      if (error) {
        return {
          status: 422,
          body: { ...await context.stateWithMockDraft(request), errors: [error] },
        };
      }
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
  const baseState = await context.state.stateFor(stateRequestFor(request, baseCommands));
  const forcedSales: ForcedAuctionSale[] = baseState.events.map(event => ({
    owner: event.owner,
    player: event.player,
    price: event.price,
  }));
  const seed = request.seed
    ?? `interactive-complete:${request.draftSessionKey}:${baseState.events.length}`;
  let batch: MockBatch;
  try {
    batch = completionBatch(context, request, forcedSales, seed);
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
  const run = batch.runs[0];
  if (!run) {
    return {
      status: 422,
      body: await errorBody(context, request, "Mock draft completion did not produce a run."),
    };
  }
  const completedCommands = [
    ...baseCommands,
    ...run.picks.map(pick => `${pick.owner} drafted ${pick.player} for ${pick.price}`),
  ];
  const completedState = await context.state.stateFor(
    stateRequestFor(request, completedCommands),
  );
  if (completedState.errors.length) {
    return {
      status: 422,
      body: { ...await context.stateWithMockDraft(request), errors: completedState.errors },
    };
  }
  await store.importCommands(completedCommands);
  const job = context.batches.publishInteractiveResults({
    draftSessionKey: request.draftSessionKey,
    watchOwner: request.watchOwner,
    strategyKey: request.strategyKey,
    commandCount: completedCommands.length,
    batch,
  });
  const responseRequest = {
    ...mockDraftRequestFor(request.strategyKey, request.seed),
    draftSessionKey: request.draftSessionKey,
    watchOwner: request.watchOwner,
  };
  return {
    status: 200,
    body: {
      ...await context.stateWithMockDraft(responseRequest),
      mockBatchJob: context.batches.responseFor(job),
    },
  };
};
