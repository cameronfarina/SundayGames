import type { LiveDraftRoomEvent } from "../contracts/events.js";
import type { EndLiveDraftRoomInput } from "../contracts/inputs.js";
import type { LiveDraftRoom } from "../contracts/room.js";
import { eventIdFor } from "../common.js";
import { LiveDraftRoomError } from "../error.js";
import { assertRoomNotEnded } from "../guards.js";
import { mutationMetadataFor } from "../idempotency.js";
import { appendEvent } from "../roomEvents.js";
import { storeRoom, type LiveDraftRoomRepositoryContext } from "./context.js";
import { prepareRoomMutation } from "./mutation.js";

export const endRoom = (
  context: LiveDraftRoomRepositoryContext,
  input: EndLiveDraftRoomInput,
): LiveDraftRoom => {
  const payload = { allowIncomplete: input.allowIncomplete === true };
  const prepared = prepareRoomMutation(context, input, "end", payload);
  if (prepared.replayedRoom !== undefined) return prepared.replayedRoom;
  assertRoomNotEnded(prepared.room);
  const incompleteTeams = prepared.room.projection.teams
    .filter(team => team.rosterSlotsRemaining > 0)
    .map(team => ({
      teamId: team.teamId,
      ownerDisplayName: team.ownerDisplayName,
      teamDisplayName: team.teamDisplayName,
      openRosterSlots: team.rosterSlotsRemaining,
    }));
  if (incompleteTeams.length > 0 && input.allowIncomplete !== true) {
    throw new LiveDraftRoomError(
      "draft_incomplete",
      `Draft is incomplete: ${incompleteTeams.length} teams have open roster slots: ${incompleteTeams
        .map(team => `${team.ownerDisplayName} (${team.openRosterSlots})`)
        .join(", ")}.`,
    );
  }

  const now = input.now ?? new Date();
  const revision = prepared.room.revision + 1;
  const event: LiveDraftRoomEvent = {
    id: eventIdFor(prepared.room.roomId, revision, "room_ended"),
    roomId: prepared.room.roomId,
    leagueId: prepared.room.leagueId,
    seasonId: prepared.room.seasonId,
    revision,
    type: "room_ended",
    actorUserId: input.actor.userId,
    occurredAt: now,
    ...mutationMetadataFor(input, prepared.mutationHash),
    incomplete: incompleteTeams.length > 0,
    incompleteTeams,
  };
  return storeRoom(context, appendEvent(prepared.room, event, "ended", now, now));
};
