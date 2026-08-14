import type { LiveDraftMutation } from "../api/liveDraftApi";

interface MutationContext {
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
  readonly roomId: string;
}

export type LiveDraftAction =
  | { readonly action: "start" | "pause" | "resume" | "reopen" | "undo" }
  | { readonly action: "sales"; readonly command: string }
  | {
    readonly action: "corrections";
    readonly replacementSale: string;
    readonly saleEventId: string;
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
      return { action: action.action, ...context };
    case "sales":
      return { action: action.action, command: action.command, ...context };
    case "corrections":
      return {
        action: action.action,
        replacementSale: action.replacementSale,
        saleEventId: action.saleEventId,
        ...context,
      };
    case "end":
      return action.allowIncomplete === undefined
        ? { action: action.action, ...context }
        : { action: action.action, allowIncomplete: action.allowIncomplete, ...context };
  }
};
