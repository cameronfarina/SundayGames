import type { LiveDraftRoomEvent } from "../../liveDraftRooms.js";
import type { LiveDraftRoomSsePayload } from "../contracts/sse.js";
import { eventStreamIdFor } from "../identifiers.js";

type LifecycleEvent = Extract<
  LiveDraftRoomEvent,
  { type: "room_started" | "room_paused" | "room_resumed" }
>;

export const buildLifecycleEvent = (event: LifecycleEvent): LiveDraftRoomSsePayload => {
  const status = event.type === "room_paused" ? "paused" : "live";
  const eventName = event.type === "room_started"
    ? "room.started"
    : event.type === "room_paused"
      ? "room.paused"
      : "room.resumed";

  return {
    id: eventStreamIdFor(event.roomId, event.revision),
    event: eventName,
    revision: event.revision,
    data: {
      roomId: event.roomId,
      leagueId: event.leagueId,
      seasonId: event.seasonId,
      status,
      revision: event.revision,
      occurredAt: event.occurredAt.toISOString(),
    },
  };
};
