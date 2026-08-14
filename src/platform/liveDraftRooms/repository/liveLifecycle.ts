import type { LiveDraftRoomEvent } from "../contracts/events.js";
import type { MutateLiveDraftRoomInput } from "../contracts/inputs.js";
import type { LiveDraftRoom } from "../contracts/room.js";
import { eventIdFor } from "../common.js";
import {
  assertRoomCanStart,
  assertRoomLive,
  assertRoomNotEnded,
  assertRoomPaused,
} from "../guards.js";
import { mutationMetadataFor } from "../idempotency.js";
import { appendEvent } from "../roomEvents.js";
import { storeRoom, type LiveDraftRoomRepositoryContext } from "./context.js";
import { prepareRoomMutation } from "./mutation.js";

export const startRoom = (
  context: LiveDraftRoomRepositoryContext,
  input: MutateLiveDraftRoomInput,
): LiveDraftRoom => {
  const prepared = prepareRoomMutation(context, input, "start", {});
  if (prepared.replayedRoom !== undefined) return prepared.replayedRoom;
  assertRoomNotEnded(prepared.room);
  assertRoomCanStart(prepared.room);
  const now = input.now ?? new Date();
  const revision = prepared.room.revision + 1;
  const event: LiveDraftRoomEvent = {
    id: eventIdFor(prepared.room.roomId, revision, "room_started"),
    roomId: prepared.room.roomId,
    leagueId: prepared.room.leagueId,
    seasonId: prepared.room.seasonId,
    revision,
    type: "room_started",
    actorUserId: input.actor.userId,
    occurredAt: now,
    ...mutationMetadataFor(input, prepared.mutationHash),
  };
  return storeRoom(context, appendEvent(prepared.room, event, "live", now));
};

export const pauseRoom = (
  context: LiveDraftRoomRepositoryContext,
  input: MutateLiveDraftRoomInput,
): LiveDraftRoom => {
  const prepared = prepareRoomMutation(context, input, "pause", {});
  if (prepared.replayedRoom !== undefined) return prepared.replayedRoom;
  assertRoomNotEnded(prepared.room);
  assertRoomLive(prepared.room);
  const now = input.now ?? new Date();
  const revision = prepared.room.revision + 1;
  const event: LiveDraftRoomEvent = {
    id: eventIdFor(prepared.room.roomId, revision, "room_paused"),
    roomId: prepared.room.roomId,
    leagueId: prepared.room.leagueId,
    seasonId: prepared.room.seasonId,
    revision,
    type: "room_paused",
    actorUserId: input.actor.userId,
    occurredAt: now,
    ...mutationMetadataFor(input, prepared.mutationHash),
  };
  return storeRoom(context, appendEvent(prepared.room, event, "paused", now));
};

export const resumeRoom = (
  context: LiveDraftRoomRepositoryContext,
  input: MutateLiveDraftRoomInput,
): LiveDraftRoom => {
  const prepared = prepareRoomMutation(context, input, "resume", {});
  if (prepared.replayedRoom !== undefined) return prepared.replayedRoom;
  assertRoomNotEnded(prepared.room);
  assertRoomPaused(prepared.room);
  const now = input.now ?? new Date();
  const revision = prepared.room.revision + 1;
  const event: LiveDraftRoomEvent = {
    id: eventIdFor(prepared.room.roomId, revision, "room_resumed"),
    roomId: prepared.room.roomId,
    leagueId: prepared.room.leagueId,
    seasonId: prepared.room.seasonId,
    revision,
    type: "room_resumed",
    actorUserId: input.actor.userId,
    occurredAt: now,
    ...mutationMetadataFor(input, prepared.mutationHash),
  };
  return storeRoom(context, appendEvent(prepared.room, event, "live", now));
};
