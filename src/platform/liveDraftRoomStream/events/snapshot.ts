import type { LiveDraftRoom, LiveDraftRoomEvent } from "../../liveDraftRooms.js";
import type { BuildLiveDraftRoomReadModelInput } from "../contracts/readModel.js";
import type { LiveDraftRoomSsePayload } from "../contracts/sse.js";
import { liveDraftRoomSseRetryMilliseconds } from "../constants.js";
import { snapshotStreamIdFor } from "../identifiers.js";
import { buildLiveDraftRoomReadModel } from "../readModel.js";

export const roomAtEventRevision = (
  room: LiveDraftRoom,
  event: LiveDraftRoomEvent,
): LiveDraftRoom => ({
  ...room,
  status: event.type === "room_created" ? "setup" : room.status,
  revision: event.revision,
  updatedAt: event.occurredAt,
});

export const buildLiveDraftRoomSnapshotEvent = (
  input: BuildLiveDraftRoomReadModelInput,
): LiveDraftRoomSsePayload => ({
  id: snapshotStreamIdFor(input.room),
  event: "room.snapshot",
  revision: input.room.revision,
  retry: liveDraftRoomSseRetryMilliseconds,
  data: buildLiveDraftRoomReadModel(input),
});
