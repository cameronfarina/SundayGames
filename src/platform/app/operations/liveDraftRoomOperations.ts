import {
  assertHostedLiveDraftRoomFormat,
  LiveDraftRoomError,
  type LiveDraftRoom,
} from "../../liveDraftRooms.js";
import {
  buildLiveDraftRoomReadModel,
  liveDraftRoomEventsAfterRevision,
  type LiveDraftRoomEventsAfterRevisionResult,
  type LiveDraftRoomReadModel,
} from "../../liveDraftRoomStream.js";
import type {
  CreatePlatformLiveDraftRoomInput,
  GetPlatformLiveDraftRoomEventsInput,
  GetPlatformLiveDraftRoomInput,
  MutatePlatformLiveDraftRoomInput,
  SynchronizePlatformLiveDraftRoomInitialRostersInput,
} from "../contracts/liveDraft.js";
import type { PlatformAppContext } from "../context.js";
import { liveActorFor } from "../liveDraftHelpers.js";
import { cloneForRead } from "../shared.js";

export const createLiveDraftRoomOperations = (context: PlatformAppContext) => ({
  createLiveDraftRoom: async (input: CreatePlatformLiveDraftRoomInput): Promise<LiveDraftRoom> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const season = await context.requireSeason(input.seasonId);
    await context.requireSharedMutation(account, season.leagueId);
    assertHostedLiveDraftRoomFormat(season);
    return cloneForRead(await context.liveDraftRooms.createRoom({
      season,
      roomId: input.roomId,
      commissionerUserId: account.id,
      viewerPasswordHashRef: input.viewerPasswordHashRef,
      startsAt: input.startsAt,
      playerCatalog: input.playerCatalog,
      initialRosters: input.initialRosters === undefined ? undefined : cloneForRead(input.initialRosters),
      createdAt: input.now,
    }));
  },

  hasLiveDraftRoomForSeason: async (seasonId: string): Promise<boolean> =>
    await context.liveDraftRooms.hasRoomForSeason(seasonId),

  hasStartedLiveDraftRoomForSeason: async (seasonId: string): Promise<boolean> =>
    await context.liveDraftRooms.hasStartedRoomForSeason(seasonId),

  synchronizeLiveDraftRoomInitialRosters: async (
    input: SynchronizePlatformLiveDraftRoomInitialRostersInput,
  ): Promise<LiveDraftRoom | null> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const season = await context.requireSeason(input.seasonId);
    const membership = await context.requireSharedMutation(account, season.leagueId);
    const room = await context.liveDraftRooms.synchronizeInitialRostersForSeason({
      seasonId: season.id,
      actor: liveActorFor(account, season.leagueId, membership),
      initialRosters: cloneForRead(input.initialRosters),
      playerCatalog: cloneForRead(input.playerCatalog),
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      now: input.now,
    });
    return room === null ? null : cloneForRead(room);
  },

  cancelLiveDraftRoom: async (input: MutatePlatformLiveDraftRoomInput): Promise<void> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    let room: LiveDraftRoom;
    try {
      room = await context.liveDraftRooms.getRoom(input.roomId);
    } catch (error) {
      if (error instanceof LiveDraftRoomError && error.code === "room_not_found") {
        await context.liveDraftRooms.cancelRoom({
          roomId: input.roomId,
          actor: { userId: account.id, leagueId: "" },
          expectedRevision: input.expectedRevision,
          idempotencyKey: input.idempotencyKey,
          now: input.now,
        });
        return;
      }
      throw error;
    }
    const membership = await context.requireSharedMutation(account, room.leagueId);
    await context.liveDraftRooms.cancelRoom({
      roomId: input.roomId,
      actor: liveActorFor(account, room.leagueId, membership),
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      now: input.now,
    });
  },

  getLiveDraftRoom: async (input: GetPlatformLiveDraftRoomInput): Promise<LiveDraftRoom> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const room = await context.liveDraftRooms.getRoom(input.roomId);
    const membership = await context.requireSharedRead(account, room.leagueId);
    return cloneForRead(await context.liveDraftRooms.getRoomForActor({
      roomId: input.roomId,
      actor: liveActorFor(account, room.leagueId, membership),
    }));
  },

  getLiveDraftRoomState: async (
    input: GetPlatformLiveDraftRoomInput,
  ): Promise<LiveDraftRoomReadModel> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const room = await context.liveDraftRooms.getRoom(input.roomId);
    const membership = await context.requireSharedRead(account, room.leagueId);
    const actor = liveActorFor(account, room.leagueId, membership);
    const authorizedRoom = await context.liveDraftRooms.getRoomForActor({ roomId: input.roomId, actor });
    return cloneForRead(buildLiveDraftRoomReadModel({
      room: authorizedRoom,
      actor,
      selectedTeamId: input.selectedTeamId,
      viewedTeamId: input.viewedTeamId,
    }));
  },

  getLiveDraftRoomEvents: async (
    input: GetPlatformLiveDraftRoomEventsInput,
  ): Promise<LiveDraftRoomEventsAfterRevisionResult> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const room = await context.liveDraftRooms.getRoom(input.roomId);
    const membership = await context.requireSharedRead(account, room.leagueId);
    const actor = liveActorFor(account, room.leagueId, membership);
    await context.liveDraftRooms.getRoomForActor({ roomId: input.roomId, actor });
    return cloneForRead(liveDraftRoomEventsAfterRevision({
      room,
      actor,
      afterRevision: input.afterRevision,
    }));
  },
});
