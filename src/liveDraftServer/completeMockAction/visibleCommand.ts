import { commandForMockAction } from "../mockActionCommand.js";
import {
  mockDraftPhaseFor,
  mockDraftTopTargetNameFor,
} from "../mockState.js";
import type { CompleteContext, CompleteMockRequest } from "./contracts.js";

export const visibleAuctionCommandFor = async (
  context: CompleteContext,
  request: CompleteMockRequest,
  commands: readonly string[],
): Promise<string | undefined> => {
  const mockDraft = await context.mockDraftFor({ ...request, commands });
  const phase = mockDraftPhaseFor(mockDraft);
  if (phase === "ai-sale") {
    return commandForMockAction(context.module, mockDraft, "advance");
  }
  if (phase === "human-decision") {
    return commandForMockAction(context.module, mockDraft, "cam-bid");
  }
  if (phase === "blocked") {
    throw new Error("Mock draft is blocked and cannot be completed.");
  }
  if (phase !== "human-nomination") return undefined;
  const automaticNomination = request.nominatedPlayer ?? mockDraftTopTargetNameFor(mockDraft);
  if (!automaticNomination) return undefined;
  const nominated = await context.mockDraftFor({
    ...request,
    commands,
    nominatedPlayer: automaticNomination,
  });
  const action = mockDraftPhaseFor(nominated) === "human-decision"
    ? "cam-bid"
    : "advance";
  return commandForMockAction(context.module, nominated, action);
};
