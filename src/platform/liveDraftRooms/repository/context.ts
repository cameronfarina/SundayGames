import type { LiveDraftRoomAuthorizer } from "../contracts/repository.js";
import type { LiveDraftRoom } from "../contracts/room.js";

export interface LiveDraftRoomRepositoryContext {
  roomsById: Map<string, LiveDraftRoom>;
  authorizer: LiveDraftRoomAuthorizer | undefined;
}

export const storeRoom = (
  context: LiveDraftRoomRepositoryContext,
  room: LiveDraftRoom,
): LiveDraftRoom => {
  context.roomsById.set(room.roomId, room);
  return room;
};
