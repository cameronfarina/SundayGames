import {
  InMemoryLiveDraftRoomRepository,
  type LiveDraftRoom,
  type LiveDraftRoomAuthorizer,
} from "../liveDraftRooms.js";

export const repositoryForRoom = (
  room: LiveDraftRoom,
  authorizer: LiveDraftRoomAuthorizer | undefined,
): InMemoryLiveDraftRoomRepository => {
  const repository = new InMemoryLiveDraftRoomRepository(authorizer);
  repository.replaceRooms([room]);
  return repository;
};
