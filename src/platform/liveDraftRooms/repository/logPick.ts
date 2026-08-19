import type { LiveDraftRoomEvent } from "../contracts/events.js";
import type { LogLiveDraftRoomPickInput } from "../contracts/inputs.js";
import type { LiveDraftRoom } from "../contracts/room.js";
import { eventIdFor } from "../common.js";
import { assertRoomLive, assertRoomNotEnded } from "../guards.js";
import { mutationMetadataFor } from "../idempotency.js";
import { buildPick, validatePick } from "../pick.js";
import { appendEvent } from "../roomEvents.js";
import { storeRoom, type LiveDraftRoomRepositoryContext } from "./context.js";
import { prepareRoomMutation } from "./mutation.js";

export const logPick = (
  context: LiveDraftRoomRepositoryContext,
  input: LogLiveDraftRoomPickInput,
): LiveDraftRoom => {
  const prepared = prepareRoomMutation(context, input, "log_pick", input.pick);
  if (prepared.replayedRoom !== undefined) return prepared.replayedRoom;
  assertRoomNotEnded(prepared.room);
  assertRoomLive(prepared.room);

  const now = input.now ?? new Date();
  const revision = prepared.room.revision + 1;
  const eventId = eventIdFor(prepared.room.roomId, revision, "pick_logged");
  const pick = buildPick(prepared.room, input.pick, eventId);
  validatePick(prepared.room, pick);
  const event: LiveDraftRoomEvent = {
    id: eventId,
    roomId: prepared.room.roomId,
    leagueId: prepared.room.leagueId,
    seasonId: prepared.room.seasonId,
    revision,
    type: "pick_logged",
    actorUserId: input.actor.userId,
    occurredAt: now,
    ...mutationMetadataFor(input, prepared.mutationHash),
    pick,
  };
  return storeRoom(context, appendEvent(prepared.room, event, "live", now));
};
