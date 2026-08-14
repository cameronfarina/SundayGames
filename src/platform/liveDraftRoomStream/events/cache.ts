import type {
  LiveDraftRoomCacheSseEventName,
  LiveDraftRoomCacheSsePayload,
} from "../contracts/sse.js";
import type { LiveDraftRoomReadModel } from "../contracts/readModel.js";
import { liveDraftRoomSseRetryMilliseconds } from "../constants.js";
import { eventStreamIdFor } from "../identifiers.js";

export const buildLiveDraftRoomCacheSseEvent = (
  room: LiveDraftRoomReadModel,
  event: LiveDraftRoomCacheSseEventName,
): LiveDraftRoomCacheSsePayload => ({
  id: event === "room.snapshot"
    ? `${eventStreamIdFor(room.roomId, room.revision)}:snapshot`
    : eventStreamIdFor(room.roomId, room.revision),
  event,
  revision: room.revision,
  ...(event === "room.snapshot" ? { retry: liveDraftRoomSseRetryMilliseconds } : {}),
  data: room,
});
