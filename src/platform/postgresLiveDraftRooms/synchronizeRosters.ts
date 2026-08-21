import type {
  LiveDraftRoom,
  LiveDraftRoomAuthorizer,
  SynchronizeLiveDraftRoomInitialRostersInput,
} from "../liveDraftRooms.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { insertDraftRoomEvent } from "./eventPersistence.js";
import { repositoryForRoom } from "./memoryRepository.js";
import { updateDraftRoomRevision } from "./roomPersistence.js";
import { latestRoomSnapshotForSeason } from "./seasonSnapshotRead.js";
import { cloneRoom } from "./snapshotCodec.js";
import { insertDraftRoomSnapshot } from "./snapshotPersistence.js";
import { publishLiveDraftRoomRevision } from "../liveDraftRoomRealtime.js";

export const synchronizeInitialRostersForSeason = async (
  client: PostgresQueryClient,
  authorizer: LiveDraftRoomAuthorizer | undefined,
  input: SynchronizeLiveDraftRoomInitialRostersInput,
): Promise<LiveDraftRoom | null> => {
  const currentRoom = await latestRoomSnapshotForSeason(client, input.seasonId);
  if (currentRoom === undefined) return null;
  const updatedRoom = repositoryForRoom(currentRoom, authorizer)
    .synchronizeInitialRostersForSeason(input);
  if (updatedRoom === null) return null;
  if (updatedRoom.revision === currentRoom.revision) return cloneRoom(updatedRoom);
  const newEvent = updatedRoom.events.find(event => event.revision === updatedRoom.revision);
  if (newEvent === undefined) {
    throw new Error(`Live draft room revision ${updatedRoom.revision} did not produce an event.`);
  }
  await updateDraftRoomRevision(client, updatedRoom, currentRoom.revision);
  await insertDraftRoomEvent(client, newEvent, currentRoom.revision);
  await insertDraftRoomSnapshot(client, updatedRoom);
  await publishLiveDraftRoomRevision(client, updatedRoom.roomId, updatedRoom.revision);
  return cloneRoom(updatedRoom);
};
