import type { LiveDraftRoomStatus } from "../contracts/core.js";
import type { LiveDraftRoomEvent } from "../contracts/events.js";
import type { CreateLiveDraftRoomInput } from "../contracts/inputs.js";
import type { LiveDraftRoom } from "../contracts/room.js";
import { eventIdFor } from "../common.js";
import { normalizeCatalog } from "../catalog.js";
import { LiveDraftRoomError } from "../error.js";
import { assertSeasonReady } from "../format.js";
import { validateInitialRosters } from "../initialRosterValidation.js";
import { roomWithProjection } from "../projection.js";
import { storeRoom, type LiveDraftRoomRepositoryContext } from "./context.js";

export const createRoom = (
  context: LiveDraftRoomRepositoryContext,
  input: CreateLiveDraftRoomInput,
): LiveDraftRoom => {
  assertSeasonReady(input.season);
  if (context.roomsById.has(input.roomId)) {
    throw new LiveDraftRoomError(
      "room_already_exists",
      `Live draft room "${input.roomId}" already exists.`,
    );
  }
  if ([...context.roomsById.values()].some(room => room.seasonId === input.season.id)) {
    throw new LiveDraftRoomError(
      "room_already_exists",
      `A live draft room already exists for season "${input.season.id}".`,
    );
  }
  validateInitialRosters(input.season, input.initialRosters ?? []);

  const createdAt = input.createdAt ?? new Date();
  const status: LiveDraftRoomStatus = input.startsAt !== undefined
    && input.startsAt.getTime() > createdAt.getTime()
    ? "countdown"
    : "setup";
  const revision = 1;
  const event: LiveDraftRoomEvent = {
    id: eventIdFor(input.roomId, revision, "room_created"),
    roomId: input.roomId,
    leagueId: input.season.leagueId,
    seasonId: input.season.id,
    revision,
    type: "room_created",
    actorUserId: input.commissionerUserId,
    occurredAt: createdAt,
  };
  const room = roomWithProjection({
    roomId: input.roomId,
    leagueId: input.season.leagueId,
    seasonId: input.season.id,
    status,
    commissionerUserId: input.commissionerUserId,
    ...(input.startsAt === undefined ? {} : { startsAt: input.startsAt }),
    viewerPasswordHashRef: input.viewerPasswordHashRef,
    revision,
    createdAt,
    updatedAt: createdAt,
    season: input.season,
    playerCatalog: normalizeCatalog(input.playerCatalog),
    initialRosters: [...(input.initialRosters ?? [])],
    events: [event],
  });
  return storeRoom(context, room);
};
