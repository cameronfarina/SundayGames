import type { LiveDraftRoomEvent } from "./contracts/events.js";
import type { LiveDraftRoomPickSelection } from "./contracts/players.js";

export interface ActiveLiveDraftRoomPick {
  sourceEventId: string;
  pick: LiveDraftRoomPickSelection;
}

export const activePicksFor = (
  events: readonly LiveDraftRoomEvent[],
): readonly ActiveLiveDraftRoomPick[] => {
  const eventsById = new Map(events.map(event => [event.id, event]));
  const activePicksBySourceEventId = new Map<string, ActiveLiveDraftRoomPick>();

  for (const event of events) {
    if (event.type === "pick_logged") {
      activePicksBySourceEventId.set(event.id, { sourceEventId: event.id, pick: event.pick });
    }
    if (event.type === "pick_corrected") {
      activePicksBySourceEventId.delete(event.correctedPickEventId);
      activePicksBySourceEventId.set(event.id, {
        sourceEventId: event.id,
        pick: event.replacementPick,
      });
    }
    if (event.type === "pick_undone") {
      activePicksBySourceEventId.delete(event.undonePickEventId);
      const undoneEvent = eventsById.get(event.undonePickEventId);
      if (undoneEvent?.type === "pick_corrected") {
        activePicksBySourceEventId.set(undoneEvent.correctedPickEventId, {
          sourceEventId: undoneEvent.correctedPickEventId,
          pick: undoneEvent.previousPick,
        });
      }
    }
  }

  return [...activePicksBySourceEventId.values()]
    .sort((left, right) => left.pick.overall - right.pick.overall);
};
