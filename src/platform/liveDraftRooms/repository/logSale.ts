import type { LiveDraftRoomEvent } from "../contracts/events.js";
import type { LogLiveDraftRoomSaleInput } from "../contracts/inputs.js";
import type { LiveDraftRoom } from "../contracts/room.js";
import { eventIdFor } from "../common.js";
import { assertRoomLive, assertRoomNotEnded } from "../guards.js";
import { mutationMetadataFor } from "../idempotency.js";
import { appendEvent } from "../roomEvents.js";
import { buildSale, validateSale } from "../sale.js";
import { storeRoom, type LiveDraftRoomRepositoryContext } from "./context.js";
import { prepareRoomMutation } from "./mutation.js";

export const logSaleCommand = (
  context: LiveDraftRoomRepositoryContext,
  input: LogLiveDraftRoomSaleInput,
): LiveDraftRoom => {
  const prepared = prepareRoomMutation(context, input, "log_sale", input.sale);
  if (prepared.replayedRoom !== undefined) return prepared.replayedRoom;
  assertRoomNotEnded(prepared.room);
  assertRoomLive(prepared.room);

  const now = input.now ?? new Date();
  const revision = prepared.room.revision + 1;
  const eventId = eventIdFor(prepared.room.roomId, revision, "sale_logged");
  const sale = buildSale(prepared.room, input.sale, eventId);
  validateSale(prepared.room, sale);
  const event: LiveDraftRoomEvent = {
    id: eventId,
    roomId: prepared.room.roomId,
    leagueId: prepared.room.leagueId,
    seasonId: prepared.room.seasonId,
    revision,
    type: "sale_logged",
    actorUserId: input.actor.userId,
    occurredAt: now,
    ...mutationMetadataFor(input, prepared.mutationHash),
    sale,
  };
  return storeRoom(context, appendEvent(prepared.room, event, "live", now));
};
