import type { LiveDraftRoomActor } from "../contracts/core.js";
import type { LiveDraftRoom } from "../contracts/room.js";
import { LiveDraftRoomError } from "../error.js";
import { assertReader } from "../guards.js";
import type { LiveDraftRoomRepositoryContext } from "./context.js";

export const getRoom = (
  context: LiveDraftRoomRepositoryContext,
  roomId: string,
): LiveDraftRoom => {
  const room = context.roomsById.get(roomId);
  if (room === undefined) {
    throw new LiveDraftRoomError("room_not_found", `Live draft room "${roomId}" was not found.`);
  }
  return room;
};

export const getRoomForActor = (
  context: LiveDraftRoomRepositoryContext,
  input: { roomId: string; actor: LiveDraftRoomActor },
): LiveDraftRoom => {
  const room = getRoom(context, input.roomId);
  assertReader(room, input.actor, context.authorizer);
  return room;
};

export const hasStartedRoomForSeason = (
  context: LiveDraftRoomRepositoryContext,
  seasonId: string,
): boolean => [...context.roomsById.values()].some(room =>
  room.seasonId === seasonId && room.events.some(event => event.type === "room_started")
);

export const hasRoomForSeason = (
  context: LiveDraftRoomRepositoryContext,
  seasonId: string,
): boolean => [...context.roomsById.values()].some(room => room.seasonId === seasonId);
