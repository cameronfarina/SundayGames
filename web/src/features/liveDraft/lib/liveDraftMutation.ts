import type { LiveDraftMutation } from "../api/liveDraftApi";

interface MutationContext {
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
  readonly roomId: string;
}

export type LiveDraftAction =
  | { readonly action: "start" | "pause" | "resume" | "reopen" | "undo" | "undo-pick" }
  | { readonly action: "sales"; readonly command: string }
  | { readonly action: "picks"; readonly playerName: string }
  | {
    readonly action: "corrections";
    readonly replacementSale: string;
    readonly saleEventId: string;
  }
  | {
    readonly action: "pick-corrections";
    readonly pickEventId: string;
    readonly replacementPlayerName: string;
  }
  | { readonly action: "end"; readonly allowIncomplete?: boolean };

export const buildLiveDraftMutation = (
  action: LiveDraftAction,
  context: MutationContext,
): LiveDraftMutation => {
  switch (action.action) {
    case "start":
    case "pause":
    case "resume":
    case "reopen":
    case "undo":
    case "undo-pick":
      return { action: action.action, ...context };
    case "sales":
      return { action: action.action, command: action.command, ...context };
    case "picks":
      return { action: action.action, playerName: action.playerName, ...context };
    case "corrections":
      return {
        action: action.action,
        replacementSale: action.replacementSale,
        saleEventId: action.saleEventId,
        ...context,
      };
    case "pick-corrections":
      return {
        action: action.action,
        pickEventId: action.pickEventId,
        replacementPlayerName: action.replacementPlayerName,
        ...context,
      };
    case "end":
      return action.allowIncomplete === undefined
        ? { action: action.action, ...context }
        : { action: action.action, allowIncomplete: action.allowIncomplete, ...context };
  }
};
