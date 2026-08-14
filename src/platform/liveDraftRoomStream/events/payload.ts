import type { LiveDraftRoomSsePayload, BuildLiveDraftRoomSseEventInput } from "../contracts/sse.js";
import { eventStreamIdFor } from "../identifiers.js";
import { saleLogEntryFor } from "../saleLog.js";
import { eventNameFor } from "./eventName.js";
import { buildLifecycleEvent } from "./lifecycle.js";
import { buildLiveDraftRoomSnapshotEvent, roomAtEventRevision } from "./snapshot.js";

export const buildLiveDraftRoomSseEvent = (
  input: BuildLiveDraftRoomSseEventInput,
): LiveDraftRoomSsePayload => {
  if (eventNameFor(input.event) === "room.snapshot") {
    return buildLiveDraftRoomSnapshotEvent({
      room: roomAtEventRevision(input.room, input.event),
      actor: input.actor,
    });
  }

  if (input.event.type === "sale_logged") {
    return {
      id: eventStreamIdFor(input.event.roomId, input.event.revision),
      event: "room.sale",
      revision: input.event.revision,
      data: {
        roomId: input.event.roomId,
        leagueId: input.event.leagueId,
        seasonId: input.event.seasonId,
        status: "live",
        revision: input.event.revision,
        occurredAt: input.event.occurredAt.toISOString(),
        sale: saleLogEntryFor(input.event.sale, input.event.revision, input.event.occurredAt),
      },
    };
  }

  if (
    input.event.type === "room_started" ||
    input.event.type === "room_paused" ||
    input.event.type === "room_resumed"
  ) {
    return buildLifecycleEvent(input.event);
  }

  return {
    id: eventStreamIdFor(input.event.roomId, input.event.revision),
    event: "room.ended",
    revision: input.event.revision,
    data: {
      roomId: input.event.roomId,
      leagueId: input.event.leagueId,
      seasonId: input.event.seasonId,
      status: "ended",
      revision: input.event.revision,
      occurredAt: input.event.occurredAt.toISOString(),
    },
  };
};
