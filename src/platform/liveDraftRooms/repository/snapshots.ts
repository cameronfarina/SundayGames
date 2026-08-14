import type { LiveDraftRoom } from "../contracts/room.js";
import type { LiveDraftRoomSummary } from "../contracts/room.js";
import { roomWithProjection } from "../projection.js";
import type { LiveDraftRoomRepositoryContext } from "./context.js";

export const rooms = (
  context: LiveDraftRoomRepositoryContext,
): readonly LiveDraftRoom[] =>
  [...context.roomsById.values()].map(room => structuredClone(room));

export const roomSummaries = (
  context: LiveDraftRoomRepositoryContext,
): readonly LiveDraftRoomSummary[] =>
  [...context.roomsById.values()].map(room => ({
    roomId: room.roomId,
    leagueId: room.leagueId,
    seasonId: room.seasonId,
    status: room.status,
    ...(room.startsAt === undefined ? {} : { startsAt: new Date(room.startsAt) }),
    createdAt: new Date(room.createdAt),
  }));

export const replaceRooms = (
  context: LiveDraftRoomRepositoryContext,
  replacementRooms: readonly LiveDraftRoom[],
): void => {
  context.roomsById.clear();
  for (const room of replacementRooms) {
    const { projection: _projection, ...roomWithoutProjection } = structuredClone(room);
    const storedRoom = roomWithProjection(roomWithoutProjection);
    context.roomsById.set(storedRoom.roomId, storedRoom);
  }
};
