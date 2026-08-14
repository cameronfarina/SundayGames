import { ownerOrder } from "../../config/league.js";
import type { FileBackedLiveDraftSessionStore } from "../liveDraftSessionStore.js";
import type { InteractiveMockDraftModule } from "./contracts.js";
import { commandForMockAction } from "./mockActionCommand.js";
import {
  mockDraftPhaseFor,
  mockDraftPickNumberFor,
  mockDraftRequestFor,
  mockDraftRoundForPick,
  mockDraftTopTargetNameFor,
} from "./mockState.js";
import type { InteractiveMockService, MockDraftRequest, StateService } from "./runtimeContracts.js";

interface AdvanceContext {
  module: InteractiveMockDraftModule;
  store: FileBackedLiveDraftSessionStore;
  state: StateService;
  mockDraftFor: InteractiveMockService["mockDraftFor"];
  stateWithMockDraft: InteractiveMockService["stateWithMockDraft"];
}

type RequiredRequest = Required<Pick<MockDraftRequest, "draftSessionKey" | "watchOwner" | "strategyKey">> &
  Omit<MockDraftRequest, "draftSessionKey" | "watchOwner" | "strategyKey">;

const appendCommand = async (
  context: AdvanceContext,
  request: RequiredRequest,
  command: string,
): Promise<{ input: string; message: string } | undefined> => {
  const trialCommands = [...context.store.currentCommands(), command];
  const trialState = await context.state.stateFor({
    draftSessionKey: request.draftSessionKey,
    mode: "interactive-mock",
    commands: trialCommands,
    strategyKey: request.strategyKey,
    watchOwner: request.watchOwner,
  });
  const error = trialState.errors.find(item => item.input === command);
  if (error) return error;
  await context.store.appendCommand(command);
  return undefined;
};

export const advanceMockAction = async (
  context: AdvanceContext,
  request: RequiredRequest & { action: string },
) => {
  const maximumSteps = ownerOrder.length * 20;
  let appendedCount = 0;
  let startRound: number | undefined;
  let nextNominatedPlayer = request.nominatedPlayer;
  let nextNominatedPrice = request.nominatedPrice;
  for (let step = 0; step < maximumSteps; step += 1) {
    const mockDraft = await context.mockDraftFor({
      ...mockDraftRequestFor(
        request.strategyKey,
        request.seed,
        nextNominatedPlayer,
        nextNominatedPrice,
      ),
      draftSessionKey: request.draftSessionKey,
      watchOwner: request.watchOwner,
    });
    const phase = mockDraftPhaseFor(mockDraft);
    const pickNumber = mockDraftPickNumberFor(mockDraft);
    startRound ??= mockDraftRoundForPick(pickNumber);
    if (request.action === "next-ai-sale" && appendedCount > 0) break;
    if ((request.action === "next-cam-decision" || request.action === "next-round") &&
      ["human-decision", "human-nomination", "complete", "blocked"].includes(phase)) break;
    if (request.action === "next-round" && appendedCount > 0 &&
      mockDraftRoundForPick(pickNumber) !== startRound) break;

    let command: string | undefined;
    if (phase === "ai-sale") {
      command = commandForMockAction(context.module, mockDraft, "advance");
    } else if (phase === "human-decision" && request.action === "complete-mock") {
      command = commandForMockAction(context.module, mockDraft, "cam-bid");
    } else if (phase === "human-nomination" && request.action === "complete-mock") {
      const automaticNomination = mockDraftTopTargetNameFor(mockDraft);
      if (!automaticNomination) break;
      const nominated = await context.mockDraftFor({
        ...mockDraftRequestFor(request.strategyKey, request.seed, automaticNomination),
        draftSessionKey: request.draftSessionKey,
        watchOwner: request.watchOwner,
      });
      command = commandForMockAction(
        context.module,
        nominated,
        mockDraftPhaseFor(nominated) === "human-decision" ? "cam-bid" : "advance",
      );
    } else {
      break;
    }
    const error = await appendCommand(context, request, command);
    if (error) {
      return {
        status: 422,
        body: {
          ...await context.stateWithMockDraft({
            ...mockDraftRequestFor(
              request.strategyKey,
              request.seed,
              nextNominatedPlayer,
              nextNominatedPrice,
            ),
            draftSessionKey: request.draftSessionKey,
            watchOwner: request.watchOwner,
          }),
          errors: [error],
        },
      };
    }
    appendedCount += 1;
    nextNominatedPlayer = undefined;
    nextNominatedPrice = undefined;
  }
  return {
    status: 200,
    body: await context.stateWithMockDraft({
      ...mockDraftRequestFor(request.strategyKey, request.seed),
      draftSessionKey: request.draftSessionKey,
      watchOwner: request.watchOwner,
    }),
  };
};
