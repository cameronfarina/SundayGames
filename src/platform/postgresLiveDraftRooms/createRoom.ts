import {
  assertHostedLiveDraftRoomFormat,
  InMemoryLiveDraftRoomRepository,
  LiveDraftRoomError,
  type CreateLiveDraftRoomInput,
  type LiveDraftRoom,
  type LiveDraftRoomAuthorizer,
} from "../liveDraftRooms.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { insertDraftRoomEvent } from "./eventPersistence.js";
import { insertDraftRoom } from "./roomPersistence.js";
import { cloneRoom } from "./snapshotCodec.js";
import { insertDraftRoomSnapshot } from "./snapshotPersistence.js";
import { latestRoomSnapshot } from "./snapshotRead.js";

export const createRoom = async (
  client: PostgresQueryClient,
  authorizer: LiveDraftRoomAuthorizer | undefined,
  input: CreateLiveDraftRoomInput,
): Promise<LiveDraftRoom> => {
  const existingRoom = await latestRoomSnapshot(client, input.roomId);
  if (existingRoom !== undefined) {
    throw new LiveDraftRoomError(
      "room_already_exists",
      `Live draft room "${input.roomId}" already exists.`,
    );
  }
  const memoryRepository = new InMemoryLiveDraftRoomRepository(authorizer);
  const room = memoryRepository.createRoom(input);
  const createdEvent = room.events[0];
  if (createdEvent === undefined) {
    throw new Error("Live draft room creation did not produce an event.");
  }
  await insertDraftRoom(client, room);
  await insertDraftRoomEvent(client, createdEvent, undefined);
  await insertDraftRoomSnapshot(client, room);
  return cloneRoom(room);
};

export const assertCreateRoomFormat = (input: CreateLiveDraftRoomInput): void =>
  assertHostedLiveDraftRoomFormat(input.season);
