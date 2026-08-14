import type { MutateLiveDraftRoomInput } from "../contracts/inputs.js";
import {
  assertExpectedRevision,
  assertMutationMetadata,
  assertRoomCanBeCancelled,
  assertWriter,
} from "../guards.js";
import type { LiveDraftRoomRepositoryContext } from "./context.js";

export const cancelRoom = (
  context: LiveDraftRoomRepositoryContext,
  input: MutateLiveDraftRoomInput,
): void => {
  assertMutationMetadata(input);
  const room = context.roomsById.get(input.roomId);
  if (room === undefined) return;
  assertWriter(room, input.actor, "cancel", context.authorizer);
  assertExpectedRevision(room, input.expectedRevision);
  assertRoomCanBeCancelled(room);
  context.roomsById.delete(room.roomId);
};
