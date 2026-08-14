import type { LiveDraftRoom } from "../../liveDraftRooms.js";
import type {
  EndPlatformLiveDraftRoomInput,
  MutatePlatformLiveDraftRoomInput,
} from "../contracts/liveDraft.js";
import type { PlatformAppContext } from "../context.js";
import { liveActorFor } from "../liveDraftHelpers.js";
import { cloneForRead } from "../shared.js";

export const createLiveDraftLifecycleOperations = (context: PlatformAppContext) => ({
  startLiveDraftRoom: async (input: MutatePlatformLiveDraftRoomInput): Promise<LiveDraftRoom> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const room = await context.liveDraftRooms.getRoom(input.roomId);
    const membership = await context.requireSharedMutation(account, room.leagueId);
    return cloneForRead(await context.liveDraftRooms.startRoom({
      roomId: input.roomId,
      actor: liveActorFor(account, room.leagueId, membership),
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      now: input.now,
    }));
  },

  pauseLiveDraftRoom: async (input: MutatePlatformLiveDraftRoomInput): Promise<LiveDraftRoom> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const room = await context.liveDraftRooms.getRoom(input.roomId);
    const membership = await context.requireSharedMutation(account, room.leagueId);
    return cloneForRead(await context.liveDraftRooms.pauseRoom({
      roomId: input.roomId,
      actor: liveActorFor(account, room.leagueId, membership),
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      now: input.now,
    }));
  },

  resumeLiveDraftRoom: async (input: MutatePlatformLiveDraftRoomInput): Promise<LiveDraftRoom> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const room = await context.liveDraftRooms.getRoom(input.roomId);
    const membership = await context.requireSharedMutation(account, room.leagueId);
    return cloneForRead(await context.liveDraftRooms.resumeRoom({
      roomId: input.roomId,
      actor: liveActorFor(account, room.leagueId, membership),
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      now: input.now,
    }));
  },

  reopenLiveDraftRoom: async (input: MutatePlatformLiveDraftRoomInput): Promise<LiveDraftRoom> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const room = await context.liveDraftRooms.getRoom(input.roomId);
    const membership = await context.requireSharedMutation(account, room.leagueId);
    return cloneForRead(await context.liveDraftRooms.reopenRoom({
      roomId: input.roomId,
      actor: liveActorFor(account, room.leagueId, membership),
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      now: input.now,
    }));
  },

  endLiveDraftRoom: async (input: EndPlatformLiveDraftRoomInput): Promise<LiveDraftRoom> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const room = await context.liveDraftRooms.getRoom(input.roomId);
    const membership = await context.requireSharedMutation(account, room.leagueId);
    return cloneForRead(await context.liveDraftRooms.endRoom({
      roomId: input.roomId,
      actor: liveActorFor(account, room.leagueId, membership),
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      allowIncomplete: input.allowIncomplete,
      now: input.now,
    }));
  },
});
