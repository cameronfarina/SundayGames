import type { LiveDraftRoomStatus } from "./contracts/core.js";
import type { LiveDraftRoomEvent } from "./contracts/events.js";
import type { LiveDraftRoom } from "./contracts/room.js";
import { roomWithProjection } from "./projection.js";

export const appendEvent = (
  room: LiveDraftRoom,
  event: LiveDraftRoomEvent,
  status: LiveDraftRoomStatus,
  updatedAt: Date,
  endedAt?: Date | undefined,
): LiveDraftRoom => roomWithProjection({
  ...room,
  status,
  revision: event.revision,
  updatedAt,
  ...(endedAt === undefined ? {} : { endedAt }),
  events: [...room.events, event],
});
