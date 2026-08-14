import type { LiveDraftRoomEvent } from "../contracts/events.js";
import type { SynchronizeLiveDraftRoomInitialRostersInput } from "../contracts/inputs.js";
import type { LiveDraftRoom } from "../contracts/room.js";
import { eventIdFor } from "../common.js";
import { normalizeCatalog } from "../catalog.js";
import {
  assertExpectedRevision,
  assertIdempotencyKey,
  assertRoomCanSynchronizeInitialRosters,
  assertWriter,
} from "../guards.js";
import { mutationHashFor, replayIdempotentMutation } from "../idempotency.js";
import { validateInitialRosters } from "../initialRosterValidation.js";
import { roomWithProjection } from "../projection.js";
import { storeRoom, type LiveDraftRoomRepositoryContext } from "./context.js";

export const synchronizeInitialRostersForSeason = (
  context: LiveDraftRoomRepositoryContext,
  input: SynchronizeLiveDraftRoomInitialRostersInput,
): LiveDraftRoom | null => {
  const room = [...context.roomsById.values()]
    .find(candidate => candidate.seasonId === input.seasonId);
  if (room === undefined) return null;

  assertWriter(room, input.actor, "sync_initial_rosters", context.authorizer);
  assertExpectedRevision(room, input.expectedRevision);
  assertIdempotencyKey(input.idempotencyKey);
  const playerCatalog = normalizeCatalog(input.playerCatalog);
  const mutationHash = mutationHashFor("sync_initial_rosters", {
    initialRosters: input.initialRosters,
    playerCatalog,
  });
  const replayedRoom = replayIdempotentMutation(
    room,
    "sync_initial_rosters",
    input.idempotencyKey,
    mutationHash,
  );
  if (replayedRoom !== undefined) return replayedRoom;
  assertRoomCanSynchronizeInitialRosters(room);
  validateInitialRosters(room.season, input.initialRosters);

  const now = input.now ?? new Date();
  const revision = room.revision + 1;
  const event: LiveDraftRoomEvent = {
    id: eventIdFor(room.roomId, revision, "initial_rosters_synchronized"),
    roomId: room.roomId,
    leagueId: room.leagueId,
    seasonId: room.seasonId,
    revision,
    type: "initial_rosters_synchronized",
    actorUserId: input.actor.userId,
    occurredAt: now,
    idempotencyKey: input.idempotencyKey,
    mutationHash,
    initialRosters: structuredClone(input.initialRosters),
    playerCatalog: structuredClone(playerCatalog),
  };
  const updatedRoom = roomWithProjection({
    ...room,
    revision,
    updatedAt: now,
    initialRosters: structuredClone(input.initialRosters),
    playerCatalog: structuredClone(playerCatalog),
    events: [...room.events, event],
  });
  return storeRoom(context, updatedRoom);
};
