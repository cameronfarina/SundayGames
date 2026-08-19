import type { LiveDraftRoom } from "../../liveDraftRooms.js";
import type {
  CorrectPlatformLiveDraftPickInput,
  LogPlatformLiveDraftPickInput,
  MutatePlatformLiveDraftRoomInput,
} from "../contracts/liveDraft.js";
import type { PlatformAppContext } from "../context.js";
import { liveActorFor } from "../liveDraftHelpers.js";
import { cloneForRead } from "../shared.js";

export const createLiveDraftPickOperations = (context: PlatformAppContext) => ({
  logLiveDraftPick: async (input: LogPlatformLiveDraftPickInput): Promise<LiveDraftRoom> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const room = await context.liveDraftRooms.getRoom(input.roomId);
    const membership = await context.requireSharedMutation(account, room.leagueId);
    return cloneForRead(await context.liveDraftRooms.logPick({
      roomId: input.roomId,
      actor: liveActorFor(account, room.leagueId, membership),
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      now: input.now,
      pick: input.pick,
    }));
  },

  correctLiveDraftPick: async (
    input: CorrectPlatformLiveDraftPickInput,
  ): Promise<LiveDraftRoom> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const room = await context.liveDraftRooms.getRoom(input.roomId);
    const membership = await context.requireSharedMutation(account, room.leagueId);
    return cloneForRead(await context.liveDraftRooms.correctPick({
      roomId: input.roomId,
      actor: liveActorFor(account, room.leagueId, membership),
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      now: input.now,
      pickEventId: input.pickEventId,
      replacementPick: input.replacementPick,
    }));
  },

  undoLastLiveDraftPick: async (
    input: MutatePlatformLiveDraftRoomInput,
  ): Promise<LiveDraftRoom> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const room = await context.liveDraftRooms.getRoom(input.roomId);
    const membership = await context.requireSharedMutation(account, room.leagueId);
    return cloneForRead(await context.liveDraftRooms.undoLastPick({
      roomId: input.roomId,
      actor: liveActorFor(account, room.leagueId, membership),
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      now: input.now,
    }));
  },
});
