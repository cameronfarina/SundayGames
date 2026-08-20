import type { LiveDraftRoom } from "../../liveDraftRooms.js";
import {
  buildLiveDraftRoomReadModel,
  liveDraftRoomEventsAfterRevision,
  type LiveDraftRoomEventsAfterRevisionResult,
  type LiveDraftRoomReadModel,
} from "../../liveDraftRoomStream.js";
import type {
  GetPlatformLiveDraftRoomEventsInput,
  GetPlatformLiveDraftRoomInput,
} from "../contracts/liveDraft.js";
import type { PlatformAppContext } from "../context.js";
import { liveActorFor } from "../liveDraftHelpers.js";
import { cloneForRead } from "../shared.js";

const currentRoomContext = async (
  context: PlatformAppContext,
  input: GetPlatformLiveDraftRoomInput,
) => {
  const account = await context.requireAccount(input.actorSessionToken, input.now);
  const identity = await context.liveDraftRooms.getRoomRevision(input.roomId);
  const membership = await context.requireSharedRead(account, identity.leagueId);
  const actor = liveActorFor(account, identity.leagueId, membership);
  const room = await context.liveDraftRooms.getCurrentRoomForActor({ roomId: input.roomId, actor });
  return { account, actor, room };
};

const roomWithStreamEvents = async (
  context: PlatformAppContext,
  room: LiveDraftRoom,
  afterRevision: number,
): Promise<LiveDraftRoom> => {
  const streamEvents = await context.liveDraftRooms.getRoomEventsAfterRevision({
    room,
    afterRevision,
  });
  const eventsById = new Map(room.events.map(event => [event.id, event]));
  for (const event of streamEvents) eventsById.set(event.id, event);
  return {
    ...room,
    events: [...eventsById.values()].sort((left, right) => left.revision - right.revision),
  };
};

export const createLiveDraftRoomStreamOperations = (context: PlatformAppContext) => ({
  authorizeLiveDraftRoomEventStream: async (input: GetPlatformLiveDraftRoomInput) => {
    const { account, actor, room } = await currentRoomContext(context, input);
    return {
      accountId: account.id,
      initialRoom: cloneForRead(buildLiveDraftRoomReadModel({
        room,
        actor,
        selectedTeamId: input.selectedTeamId,
        viewedTeamId: input.viewedTeamId,
      })),
      loadRevision: async (): Promise<number> => {
        const identity = await context.liveDraftRooms.getRoomRevision(input.roomId);
        if (identity.leagueId !== room.leagueId) {
          throw new Error("Live draft room identity changed during an authorized event stream.");
        }
        return identity.revision;
      },
    };
  },

  getLiveDraftRoomRevision: async (input: GetPlatformLiveDraftRoomInput): Promise<number> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const room = await context.liveDraftRooms.getRoomRevision(input.roomId);
    await context.requireSharedRead(account, room.leagueId);
    return room.revision;
  },

  getLiveDraftRoomState: async (
    input: GetPlatformLiveDraftRoomInput,
  ): Promise<LiveDraftRoomReadModel> => {
    const { actor, room } = await currentRoomContext(context, input);
    return cloneForRead(buildLiveDraftRoomReadModel({
      room,
      actor,
      selectedTeamId: input.selectedTeamId,
      viewedTeamId: input.viewedTeamId,
    }));
  },

  getLiveDraftRoomEvents: async (
    input: GetPlatformLiveDraftRoomEventsInput,
  ): Promise<LiveDraftRoomEventsAfterRevisionResult> => {
    const { actor, room } = await currentRoomContext(context, input);
    return cloneForRead(liveDraftRoomEventsAfterRevision({
      room: await roomWithStreamEvents(context, room, input.afterRevision),
      actor,
      afterRevision: input.afterRevision,
    }));
  },

  getLiveDraftRoomStreamUpdate: async (input: GetPlatformLiveDraftRoomEventsInput) => {
    const { actor, room } = await currentRoomContext(context, input);
    const roomWithEvents = await roomWithStreamEvents(context, room, input.afterRevision);
    return cloneForRead({
      events: liveDraftRoomEventsAfterRevision({
        room: roomWithEvents,
        actor,
        afterRevision: input.afterRevision,
      }),
      room: buildLiveDraftRoomReadModel({
        room,
        actor,
        selectedTeamId: input.selectedTeamId,
        viewedTeamId: input.viewedTeamId,
      }),
    });
  },
});
