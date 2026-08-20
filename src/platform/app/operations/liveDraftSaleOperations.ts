import type { LiveDraftRoom } from "../../liveDraftRooms.js";
import type {
  CorrectPlatformLiveDraftSaleInput,
  LogPlatformLiveDraftSaleInput,
  MutatePlatformLiveDraftRoomInput,
} from "../contracts/liveDraft.js";
import type { PlatformAppContext } from "../context.js";
import { liveActorFor } from "../liveDraftHelpers.js";
import { cloneForRead } from "../shared.js";

export const createLiveDraftSaleOperations = (context: PlatformAppContext) => ({
  logLiveDraftSale: async (input: LogPlatformLiveDraftSaleInput): Promise<LiveDraftRoom> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const room = await context.liveDraftRooms.getRoom(input.roomId);
    const membership = await context.requireSharedRead(account, room.leagueId);
    return cloneForRead(await context.liveDraftRooms.logSaleCommand({
      roomId: input.roomId,
      actor: liveActorFor(account, room.leagueId, membership),
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      now: input.now,
      sale: input.sale,
    }));
  },

  correctLiveDraftSale: async (
    input: CorrectPlatformLiveDraftSaleInput,
  ): Promise<LiveDraftRoom> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const room = await context.liveDraftRooms.getRoom(input.roomId);
    const membership = await context.requireSharedMutation(account, room.leagueId);
    return cloneForRead(await context.liveDraftRooms.correctSale({
      roomId: input.roomId,
      actor: liveActorFor(account, room.leagueId, membership),
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      now: input.now,
      saleEventId: input.saleEventId,
      replacementSale: input.replacementSale,
    }));
  },

  undoLastLiveDraftSale: async (
    input: MutatePlatformLiveDraftRoomInput,
  ): Promise<LiveDraftRoom> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const room = await context.liveDraftRooms.getRoom(input.roomId);
    const membership = await context.requireSharedMutation(account, room.leagueId);
    return cloneForRead(await context.liveDraftRooms.undoLastSale({
      roomId: input.roomId,
      actor: liveActorFor(account, room.leagueId, membership),
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      now: input.now,
    }));
  },
});
