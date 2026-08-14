import { activeSalesFor } from "../activeSales.js";
import type { LiveDraftRoomEvent } from "../contracts/events.js";
import type { CorrectLiveDraftRoomSaleInput } from "../contracts/inputs.js";
import type { LiveDraftRoom } from "../contracts/room.js";
import { eventIdFor } from "../common.js";
import { LiveDraftRoomError } from "../error.js";
import { assertRoomLive, assertRoomNotEnded } from "../guards.js";
import { mutationMetadataFor } from "../idempotency.js";
import { roomWithProjection } from "../projection.js";
import { appendEvent } from "../roomEvents.js";
import { buildSale, validateSale } from "../sale.js";
import { storeRoom, type LiveDraftRoomRepositoryContext } from "./context.js";
import { prepareRoomMutation } from "./mutation.js";

export const correctSale = (
  context: LiveDraftRoomRepositoryContext,
  input: CorrectLiveDraftRoomSaleInput,
): LiveDraftRoom => {
  const payload = {
    saleEventId: input.saleEventId,
    replacementSale: input.replacementSale,
  };
  const prepared = prepareRoomMutation(context, input, "correct_sale", payload);
  if (prepared.replayedRoom !== undefined) return prepared.replayedRoom;
  assertRoomNotEnded(prepared.room);
  assertRoomLive(prepared.room);

  const activeSale = activeSalesFor(prepared.room.events)
    .find(candidate => candidate.sourceEventId === input.saleEventId);
  if (activeSale === undefined) {
    throw new LiveDraftRoomError("sale_not_active", "Only an active sale can be corrected.");
  }

  const now = input.now ?? new Date();
  const revision = prepared.room.revision + 1;
  const eventId = eventIdFor(prepared.room.roomId, revision, "sale_corrected");
  const replacementSale = buildSale(prepared.room, input.replacementSale, eventId);
  const { projection: _projection, ...roomWithoutProjection } = prepared.room;
  const roomWithoutCorrectedSale = roomWithProjection(
    roomWithoutProjection,
    new Set([activeSale.sourceEventId]),
  );
  validateSale(roomWithoutCorrectedSale, replacementSale);

  const event: LiveDraftRoomEvent = {
    id: eventId,
    roomId: prepared.room.roomId,
    leagueId: prepared.room.leagueId,
    seasonId: prepared.room.seasonId,
    revision,
    type: "sale_corrected",
    actorUserId: input.actor.userId,
    occurredAt: now,
    ...mutationMetadataFor(input, prepared.mutationHash),
    correctedSaleEventId: activeSale.sourceEventId,
    previousSale: activeSale.sale,
    replacementSale,
  };
  return storeRoom(context, appendEvent(prepared.room, event, "live", now));
};
