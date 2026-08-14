import type {
  LiveDraftRoomEventsAfterRevisionInput,
  LiveDraftRoomEventsAfterRevisionResult,
} from "./contracts/sse.js";
import { eventsAfterRevision, eventsReachCurrentRevision, minimumRetainedRevisionFor } from "./eventHistory.js";
import { buildLiveDraftRoomErrorEvent } from "./events/error.js";
import { eventNameFor } from "./events/eventName.js";
import { buildLiveDraftRoomSseEvent } from "./events/payload.js";
import { buildLiveDraftRoomSnapshotEvent } from "./events/snapshot.js";

const snapshotResult = (
  input: LiveDraftRoomEventsAfterRevisionInput,
): LiveDraftRoomEventsAfterRevisionResult => ({
  currentRevision: input.room.revision,
  isStale: input.room.revision > 0,
  requiresSnapshot: true,
  events: [buildLiveDraftRoomSnapshotEvent(input)],
});

export const liveDraftRoomEventsAfterRevision = (
  input: LiveDraftRoomEventsAfterRevisionInput,
): LiveDraftRoomEventsAfterRevisionResult => {
  if (input.afterRevision <= 0) return snapshotResult(input);

  if (input.afterRevision === input.room.revision) {
    return {
      currentRevision: input.room.revision,
      isStale: false,
      requiresSnapshot: false,
      events: [],
    };
  }

  if (input.afterRevision > input.room.revision) {
    return {
      currentRevision: input.room.revision,
      isStale: true,
      requiresSnapshot: true,
      events: [buildLiveDraftRoomErrorEvent(input)],
    };
  }

  const minimumRetainedRevision = minimumRetainedRevisionFor(input.room.events);
  const isMissingRequestedRevision = minimumRetainedRevision !== undefined &&
    input.afterRevision + 1 < minimumRetainedRevision;
  if (
    isMissingRequestedRevision ||
    !eventsReachCurrentRevision(input.room.events, input.afterRevision, input.room.revision)
  ) {
    return { ...snapshotResult(input), isStale: true };
  }

  const nextEvents = eventsAfterRevision(input.room.events, input.afterRevision);
  if (nextEvents.some(event => eventNameFor(event) === "room.snapshot")) {
    return { ...snapshotResult(input), isStale: true };
  }

  return {
    currentRevision: input.room.revision,
    isStale: true,
    requiresSnapshot: false,
    events: nextEvents.map(event => buildLiveDraftRoomSseEvent({
      room: input.room,
      event,
      actor: input.actor,
    })),
  };
};
