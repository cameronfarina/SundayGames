import type { LiveDraftRoomEvent } from "../liveDraftRooms.js";

export const minimumRetainedRevisionFor = (
  events: readonly LiveDraftRoomEvent[],
): number | undefined => events.reduce<number | undefined>(
  (minimum, event) => minimum === undefined ? event.revision : Math.min(minimum, event.revision),
  undefined,
);

export const eventsAfterRevision = (
  events: readonly LiveDraftRoomEvent[],
  afterRevision: number,
): readonly LiveDraftRoomEvent[] => events
  .filter(event => event.revision > afterRevision)
  .sort((left, right) => left.revision - right.revision);

export const eventsReachCurrentRevision = (
  events: readonly LiveDraftRoomEvent[],
  afterRevision: number,
  currentRevision: number,
): boolean => {
  const nextEvents = eventsAfterRevision(events, afterRevision);

  return nextEvents.length > 0 &&
    nextEvents.at(-1)?.revision === currentRevision &&
    nextEvents.every((event, index) => event.revision === afterRevision + index + 1);
};
