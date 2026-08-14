import type { LiveDraftRoomMutationAction } from "./contracts/core.js";
import type { LiveDraftRoomEvent } from "./contracts/events.js";
import type { MutateLiveDraftRoomInput } from "./contracts/inputs.js";
import type { LiveDraftRoom } from "./contracts/room.js";
import { LiveDraftRoomError } from "./error.js";

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(item => stableStringify(item)).join(",")}]`;

  const entries = Object.entries(value).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey)
  );
  const serializedEntries = entries
    .filter(([, entryValue]) => entryValue !== undefined)
    .map(([entryKey, entryValue]) =>
      `${JSON.stringify(entryKey)}:${stableStringify(entryValue)}`
    );
  return `{${serializedEntries.join(",")}}`;
};

export const mutationHashFor = (
  action: LiveDraftRoomMutationAction,
  payload: unknown,
): string => stableStringify({ action, payload });

export const mutationMetadataFor = (
  input: MutateLiveDraftRoomInput,
  mutationHash: string,
): { idempotencyKey: string; mutationHash: string } | Record<string, never> =>
  input.idempotencyKey === undefined
    ? {}
    : { idempotencyKey: input.idempotencyKey, mutationHash };

const actionForEventType = (
  eventType: LiveDraftRoomEvent["type"],
): LiveDraftRoomMutationAction | undefined => {
  switch (eventType) {
    case "room_started": return "start";
    case "initial_rosters_synchronized": return "sync_initial_rosters";
    case "room_paused": return "pause";
    case "room_resumed": return "resume";
    case "room_reopened": return "reopen";
    case "sale_logged": return "log_sale";
    case "sale_corrected": return "correct_sale";
    case "sale_undone": return "undo_sale";
    case "room_ended": return "end";
    case "room_created": return undefined;
  }
};

export const replayIdempotentMutation = (
  room: LiveDraftRoom,
  action: LiveDraftRoomMutationAction,
  idempotencyKey: string | undefined,
  mutationHash: string,
): LiveDraftRoom | undefined => {
  if (idempotencyKey === undefined) return undefined;
  const existingEvent = room.events.find(event => event.idempotencyKey === idempotencyKey);
  if (existingEvent === undefined) return undefined;
  if (actionForEventType(existingEvent.type) !== action
    || existingEvent.mutationHash !== mutationHash) {
    throw new LiveDraftRoomError(
      "idempotency_conflict",
      "A draft room mutation already exists for this idempotency key with different input.",
    );
  }
  return room;
};
