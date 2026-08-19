import { activePicksFor } from "../activePicks.js";
import type { LiveDraftRoomEvent } from "../contracts/events.js";
import type { CorrectLiveDraftRoomPickInput } from "../contracts/inputs.js";
import type { LiveDraftRoom } from "../contracts/room.js";
import { eventIdFor } from "../common.js";
import { LiveDraftRoomError } from "../error.js";
import { assertRoomLive, assertRoomNotEnded } from "../guards.js";
import { mutationMetadataFor } from "../idempotency.js";
import { buildReplacementPick, validatePick } from "../pick.js";
import { roomWithProjection } from "../projection.js";
import { appendEvent } from "../roomEvents.js";
import { storeRoom, type LiveDraftRoomRepositoryContext } from "./context.js";
import { prepareRoomMutation } from "./mutation.js";

export const correctPick = (
  context: LiveDraftRoomRepositoryContext,
  input: CorrectLiveDraftRoomPickInput,
): LiveDraftRoom => {
  const payload = {
    pickEventId: input.pickEventId,
    replacementPick: input.replacementPick,
  };
  const prepared = prepareRoomMutation(context, input, "correct_pick", payload);
  if (prepared.replayedRoom !== undefined) return prepared.replayedRoom;
  assertRoomNotEnded(prepared.room);
  assertRoomLive(prepared.room);

  const activePick = activePicksFor(prepared.room.events)
    .find(candidate => candidate.sourceEventId === input.pickEventId);
  if (activePick === undefined) {
    throw new LiveDraftRoomError("pick_not_active", "Only an active pick can be corrected.");
  }

  const now = input.now ?? new Date();
  const revision = prepared.room.revision + 1;
  const eventId = eventIdFor(prepared.room.roomId, revision, "pick_corrected");
  const { projection: _projection, ...roomWithoutProjection } = prepared.room;
  const roomWithoutCorrectedPick = roomWithProjection(
    roomWithoutProjection,
    undefined,
    new Set([activePick.sourceEventId]),
  );
  const replacementPick = buildReplacementPick(
    roomWithoutCorrectedPick,
    activePick.pick,
    input.replacementPick,
    eventId,
  );
  validatePick(roomWithoutCorrectedPick, replacementPick);

  const event: LiveDraftRoomEvent = {
    id: eventId,
    roomId: prepared.room.roomId,
    leagueId: prepared.room.leagueId,
    seasonId: prepared.room.seasonId,
    revision,
    type: "pick_corrected",
    actorUserId: input.actor.userId,
    occurredAt: now,
    ...mutationMetadataFor(input, prepared.mutationHash),
    correctedPickEventId: activePick.sourceEventId,
    previousPick: activePick.pick,
    replacementPick,
  };
  return storeRoom(context, appendEvent(prepared.room, event, "live", now));
};
