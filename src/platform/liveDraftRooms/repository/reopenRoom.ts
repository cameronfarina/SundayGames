import type { LiveDraftRoomEvent } from "../contracts/events.js";
import type { MutateLiveDraftRoomInput } from "../contracts/inputs.js";
import type { LiveDraftRoom } from "../contracts/room.js";
import { eventIdFor } from "../common.js";
import { LiveDraftRoomError } from "../error.js";
import { mutationMetadataFor } from "../idempotency.js";
import { roomWithProjection } from "../projection.js";
import { storeRoom, type LiveDraftRoomRepositoryContext } from "./context.js";
import { prepareRoomMutation } from "./mutation.js";

export const reopenRoom = (
  context: LiveDraftRoomRepositoryContext,
  input: MutateLiveDraftRoomInput,
): LiveDraftRoom => {
  const prepared = prepareRoomMutation(context, input, "reopen", {});
  if (prepared.replayedRoom !== undefined) return prepared.replayedRoom;
  const endedEvent = [...prepared.room.events]
    .reverse()
    .find(event => event.type === "room_ended");
  const hasOpenRosterSlots = prepared.room.projection.teams.some(
    team => team.rosterSlotsRemaining > 0,
  );
  const endedIncomplete = endedEvent?.type === "room_ended"
    && (endedEvent.incomplete === true || hasOpenRosterSlots);
  if (prepared.room.status !== "ended" || !endedIncomplete) {
    throw new LiveDraftRoomError(
      "room_not_reopenable",
      "Only a draft that ended with open roster slots can be reopened.",
    );
  }

  const now = input.now ?? new Date();
  const revision = prepared.room.revision + 1;
  const event: LiveDraftRoomEvent = {
    id: eventIdFor(prepared.room.roomId, revision, "room_reopened"),
    roomId: prepared.room.roomId,
    leagueId: prepared.room.leagueId,
    seasonId: prepared.room.seasonId,
    revision,
    type: "room_reopened",
    actorUserId: input.actor.userId,
    occurredAt: now,
    ...mutationMetadataFor(input, prepared.mutationHash),
  };
  const {
    endedAt: _endedAt,
    projection: _projection,
    ...roomWithoutEndedState
  } = prepared.room;
  const updatedRoom = roomWithProjection({
    ...roomWithoutEndedState,
    status: "paused",
    revision,
    updatedAt: now,
    events: [...prepared.room.events, event],
  });
  return storeRoom(context, updatedRoom);
};
