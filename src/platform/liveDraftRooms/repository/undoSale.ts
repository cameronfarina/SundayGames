import { activeSalesFor } from "../activeSales.js";
import type { LiveDraftRoomEvent } from "../contracts/events.js";
import type { MutateLiveDraftRoomInput } from "../contracts/inputs.js";
import type { LiveDraftRoom } from "../contracts/room.js";
import { eventIdFor } from "../common.js";
import { LiveDraftRoomError } from "../error.js";
import { assertRoomLive, assertRoomNotEnded } from "../guards.js";
import { mutationMetadataFor } from "../idempotency.js";
import { appendEvent } from "../roomEvents.js";
import { storeRoom, type LiveDraftRoomRepositoryContext } from "./context.js";
import { prepareRoomMutation } from "./mutation.js";

export const undoLastSale = (
  context: LiveDraftRoomRepositoryContext,
  input: MutateLiveDraftRoomInput,
): LiveDraftRoom => {
  const prepared = prepareRoomMutation(context, input, "undo_sale", {});
  if (prepared.replayedRoom !== undefined) return prepared.replayedRoom;
  assertRoomNotEnded(prepared.room);
  assertRoomLive(prepared.room);

  const lastSale = [...activeSalesFor(prepared.room.events)].at(-1);
  if (lastSale === undefined) {
    throw new LiveDraftRoomError("no_sale_to_undo", "There is no sale to undo.");
  }
  const now = input.now ?? new Date();
  const revision = prepared.room.revision + 1;
  const event: LiveDraftRoomEvent = {
    id: eventIdFor(prepared.room.roomId, revision, "sale_undone"),
    roomId: prepared.room.roomId,
    leagueId: prepared.room.leagueId,
    seasonId: prepared.room.seasonId,
    revision,
    type: "sale_undone",
    actorUserId: input.actor.userId,
    occurredAt: now,
    ...mutationMetadataFor(input, prepared.mutationHash),
    undoneSaleEventId: lastSale.sourceEventId,
    undoneSale: lastSale.sale,
  };
  return storeRoom(context, appendEvent(prepared.room, event, "live", now));
};
