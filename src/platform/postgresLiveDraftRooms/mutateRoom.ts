import {
  LiveDraftRoomError,
  type LiveDraftRoom,
  type LiveDraftRoomAuthorizer,
  type MutateLiveDraftRoomInput,
} from "../liveDraftRooms.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { insertDraftRoomEvent } from "./eventPersistence.js";
import { repositoryForRoom } from "./memoryRepository.js";
import { updateDraftRoomRevision } from "./roomPersistence.js";
import { persistSaleProjection } from "./salePersistence.js";
import { cloneRoom } from "./snapshotCodec.js";
import { insertDraftRoomSnapshot } from "./snapshotPersistence.js";
import { latestRoomSnapshot } from "./snapshotRead.js";
import { publishLiveDraftRoomRevision } from "../liveDraftRoomRealtime.js";

export type RoomMutation = (
  repository: ReturnType<typeof repositoryForRoom>,
) => LiveDraftRoom;

export const mutateRoom = async (
  client: PostgresQueryClient,
  authorizer: LiveDraftRoomAuthorizer | undefined,
  input: MutateLiveDraftRoomInput,
  mutation: RoomMutation,
): Promise<LiveDraftRoom> => {
  const currentRoom = await latestRoomSnapshot(client, input.roomId);
  if (currentRoom === undefined) {
    throw new LiveDraftRoomError(
      "room_not_found",
      `Live draft room "${input.roomId}" was not found.`,
    );
  }
  const updatedRoom = mutation(repositoryForRoom(currentRoom, authorizer));
  if (updatedRoom.revision === currentRoom.revision) return cloneRoom(updatedRoom);
  const newEvent = updatedRoom.events.find(event => event.revision === updatedRoom.revision);
  if (newEvent === undefined) {
    throw new Error(`Live draft room revision ${updatedRoom.revision} did not produce an event.`);
  }
  await updateDraftRoomRevision(client, updatedRoom, currentRoom.revision);
  await insertDraftRoomEvent(client, newEvent, input.expectedRevision);
  await persistSaleProjection(client, newEvent, currentRoom);
  await insertDraftRoomSnapshot(client, updatedRoom);
  await publishLiveDraftRoomRevision(client, updatedRoom.roomId, updatedRoom.revision);
  return cloneRoom(updatedRoom);
};
