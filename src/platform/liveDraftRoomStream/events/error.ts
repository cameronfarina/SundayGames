import type {
  LiveDraftRoomEventsAfterRevisionInput,
  LiveDraftRoomSsePayload,
} from "../contracts/sse.js";
import { eventStreamIdFor } from "../identifiers.js";

export const buildLiveDraftRoomErrorEvent = (
  input: LiveDraftRoomEventsAfterRevisionInput,
): LiveDraftRoomSsePayload => ({
  id: `${eventStreamIdFor(input.room.roomId, input.room.revision)}:error`,
  event: "room.error",
  revision: input.room.revision,
  data: {
    roomId: input.room.roomId,
    leagueId: input.room.leagueId,
    seasonId: input.room.seasonId,
    code: "future_revision",
    message: "Client revision is ahead of the current draft room revision. Refresh from the latest snapshot.",
    currentRevision: input.room.revision,
    requestedRevision: input.afterRevision,
  },
});
