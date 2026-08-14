import { ownerOrder } from "../../config/league.js";
import type { InteractiveMockDraftModule } from "./contracts.js";
import {
  mockDraftFromInteractiveMockAction,
  optionalCommandFromInteractiveMockAction,
} from "./mockState.js";

export const commandForMockAction = (
  module: InteractiveMockDraftModule,
  mockDraft: unknown,
  action: string,
): string => {
  let currentMockDraft = mockDraft;
  for (let bidStep = 0; bidStep < ownerOrder.length * 2; bidStep += 1) {
    const result = module.resolveInteractiveMockDraftAction(currentMockDraft, action);
    const command = optionalCommandFromInteractiveMockAction(result);
    if (command) return command;
    const unresolved = mockDraftFromInteractiveMockAction(result);
    if (!unresolved) break;
    currentMockDraft = unresolved;
  }
  throw new Error("Interactive mock action did not resolve to a sale command.");
};
