import {
  InMemoryLiveDraftRoomRepository,
  LiveDraftRoomError,
  type LiveDraftRoomAuthorizer,
  type MutateLiveDraftRoomInput,
} from "../liveDraftRooms.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { repositoryForRoom } from "./memoryRepository.js";
import { deleteDraftRoom } from "./roomPersistence.js";
import { latestRoomSnapshot } from "./snapshotRead.js";

export const cancelRoom = async (
  client: PostgresQueryClient,
  authorizer: LiveDraftRoomAuthorizer | undefined,
  input: MutateLiveDraftRoomInput,
): Promise<void> => {
  const currentRoom = await latestRoomSnapshot(client, input.roomId);
  const memoryRepository = currentRoom === undefined
    ? new InMemoryLiveDraftRoomRepository(authorizer)
    : repositoryForRoom(currentRoom, authorizer);
  memoryRepository.cancelRoom(input);
  if (currentRoom === undefined) return;
  const deleted = await deleteDraftRoom(client, currentRoom.roomId, currentRoom.revision);
  if (deleted) return;
  const concurrentRoom = await latestRoomSnapshot(client, input.roomId);
  if (concurrentRoom === undefined) return;
  throw new LiveDraftRoomError(
    "stale_revision",
    "Draft room changed since this action was prepared. Refresh and try again.",
  );
};
