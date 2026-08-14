import type { LiveDraftRoomMutationAction } from "../contracts/core.js";
import type { MutateLiveDraftRoomInput } from "../contracts/inputs.js";
import type { LiveDraftRoom } from "../contracts/room.js";
import { assertExpectedRevision, assertMutationMetadata, assertWriter } from "../guards.js";
import { mutationHashFor, replayIdempotentMutation } from "../idempotency.js";
import type { LiveDraftRoomRepositoryContext } from "./context.js";
import { getRoom } from "./queries.js";

export interface PreparedRoomMutation {
  room: LiveDraftRoom;
  mutationHash: string;
  replayedRoom: LiveDraftRoom | undefined;
}

export const prepareRoomMutation = (
  context: LiveDraftRoomRepositoryContext,
  input: MutateLiveDraftRoomInput,
  action: LiveDraftRoomMutationAction,
  payload: unknown,
): PreparedRoomMutation => {
  const room = getRoom(context, input.roomId);
  const mutationHash = mutationHashFor(action, payload);
  assertWriter(room, input.actor, action, context.authorizer);
  assertMutationMetadata(input);
  const replayedRoom = replayIdempotentMutation(
    room,
    action,
    input.idempotencyKey,
    mutationHash,
  );
  if (replayedRoom === undefined) assertExpectedRevision(room, input.expectedRevision);
  return { room, mutationHash, replayedRoom };
};
