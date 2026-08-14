import { parseLiveDraftStrategyKey, type LiveDraftStrategyKey } from "../modeling/liveDraftStrategies.js";
import type { LiveDraftSessionMode } from "./contracts.js";
import { isProtectedLiveDraftMutation } from "./sessionInput.js";

export const strategyKeyFromQuery = (url: URL): LiveDraftStrategyKey =>
  parseLiveDraftStrategyKey(url.searchParams.get("strategy") ?? undefined);

export const strategyKeyFromBody = (body: Record<string, unknown>): LiveDraftStrategyKey =>
  parseLiveDraftStrategyKey(body.strategyKey);

export const unsafeLiveMutationMessage = ({
  draftSessionKey,
  mode,
  body,
  confirmField,
  actionLabel,
  commandCount,
}: {
  draftSessionKey: string;
  mode: LiveDraftSessionMode;
  body: Record<string, unknown>;
  confirmField: "confirmImport" | "confirmReset" | "confirmUndo";
  actionLabel: "import" | "reset" | "undo";
  commandCount: number;
}): string | undefined => {
  if (!isProtectedLiveDraftMutation(draftSessionKey, mode)) return undefined;
  const expected = body.expectedCommandCount;
  const expectedIsValid = typeof expected === "number" && Number.isInteger(expected) && expected >= 0;
  if (body[confirmField] !== true) {
    return `Live draft ${actionLabel} requires confirmation before changing the real room.`;
  }
  if (!expectedIsValid) {
    return `Live draft ${actionLabel} requires expectedCommandCount ${commandCount}.`;
  }
  return expected === commandCount
    ? undefined
    : `Live draft ${actionLabel} expected ${expected} command(s), but the room currently has ${commandCount}. Refresh before trying again.`;
};
