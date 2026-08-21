import {
  buildLiveDraftRoomCacheSseEvent,
  formatLiveDraftRoomSsePayloads,
  type LiveDraftRoomCacheSseEventName,
  type LiveDraftRoomEventsAfterRevisionResult,
  type LiveDraftRoomReadModel,
} from "./liveDraftRoomStream.js";

export interface LiveDraftRoomEventStreamSubscription {
  waitForRevision(input: {
    afterRevision: number;
    signal?: AbortSignal | undefined;
    timeoutMs?: number | undefined;
  }): Promise<boolean>;
  close(): void | Promise<void>;
}

export interface LiveDraftRoomEventStreamUpdate {
  events: LiveDraftRoomEventsAfterRevisionResult;
  room: LiveDraftRoomReadModel;
}

export interface CreateLiveDraftRoomEventStreamInput {
  initialRoom: LiveDraftRoomReadModel;
  loadRevision: (afterRevision: number) => Promise<number>;
  loadUpdate: (afterRevision: number) => Promise<LiveDraftRoomEventStreamUpdate>;
  subscription: LiveDraftRoomEventStreamSubscription;
  signal?: AbortSignal | undefined;
  heartbeatMilliseconds?: number | undefined;
}

export const defaultLiveDraftRoomHeartbeatMilliseconds = 15_000;
const heartbeatComment = ": keep-alive\n\n";
const signalIsAborted = (signal: AbortSignal | undefined): boolean => signal?.aborted === true;

const eventNameForUpdate = (
  afterRevision: number,
  update: LiveDraftRoomEventStreamUpdate,
): LiveDraftRoomCacheSseEventName => {
  if (
    update.room.revision !== afterRevision + 1 ||
    update.events.currentRevision !== update.room.revision
  ) {
    return "room.snapshot";
  }

  const event = update.events.events.length === 1
    ? update.events.events[0]
    : undefined;
  if (
    event === undefined ||
    event.revision !== update.room.revision ||
    event.event === "room.error"
  ) {
    return "room.snapshot";
  }

  return event.event;
};

const formattedRoomEvent = (
  room: LiveDraftRoomReadModel,
  event: LiveDraftRoomCacheSseEventName,
): string => formatLiveDraftRoomSsePayloads([
  buildLiveDraftRoomCacheSseEvent(room, event),
]);

export const createLiveDraftRoomEventStream = (
  input: CreateLiveDraftRoomEventStreamInput,
): AsyncIterable<string> => ({
  async *[Symbol.asyncIterator]() {
    let revision = input.initialRoom.revision;
    try {
      if (signalIsAborted(input.signal)) return;
      yield formattedRoomEvent(input.initialRoom, "room.snapshot");

      while (!signalIsAborted(input.signal)) {
        const notified = await input.subscription.waitForRevision({
          afterRevision: revision,
          signal: input.signal,
          timeoutMs: input.heartbeatMilliseconds ?? defaultLiveDraftRoomHeartbeatMilliseconds,
        });
        if (signalIsAborted(input.signal)) return;
        if (!notified && await input.loadRevision(revision) <= revision) {
          yield heartbeatComment;
          continue;
        }
        const update = await input.loadUpdate(revision);
        if (update.room.revision <= revision) {
          yield heartbeatComment;
          continue;
        }
        const eventName = eventNameForUpdate(revision, update);
        revision = update.room.revision;
        yield formattedRoomEvent(update.room, eventName);
      }
    } finally {
      await input.subscription.close();
    }
  },
});
