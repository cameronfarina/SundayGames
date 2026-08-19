import type {
  LiveDraftRoomActor,
  LiveDraftRoomMutationAction,
} from "./contracts/core.js";
import type { MutateLiveDraftRoomInput } from "./contracts/inputs.js";
import type { LiveDraftRoomAuthorizer } from "./contracts/repository.js";
import type { LiveDraftRoom } from "./contracts/room.js";
import { LiveDraftRoomError } from "./error.js";

const writerRoles = new Set(["owner", "admin"]);

export const assertWriter = (
  room: LiveDraftRoom,
  actor: LiveDraftRoomActor,
  action: LiveDraftRoomMutationAction,
  authorizer: LiveDraftRoomAuthorizer | undefined,
): void => {
  const isLeagueMember = actor.leagueId === room.leagueId;
  const allowedByDefault = isLeagueMember && (
    actor.userId === room.commissionerUserId
    || (actor.role !== undefined && writerRoles.has(actor.role))
  );
  const allowed = authorizer === undefined
    ? allowedByDefault
    : authorizer({ actor, action, room });
  if (!allowed) {
    throw new LiveDraftRoomError(
      "mutation_denied",
      "Only the commissioner or league admins can change this draft room.",
    );
  }
};

export const assertReader = (
  room: LiveDraftRoom,
  actor: LiveDraftRoomActor,
  authorizer: LiveDraftRoomAuthorizer | undefined,
): void => {
  const allowedByDefault = actor.leagueId === room.leagueId;
  const allowed = authorizer === undefined
    ? allowedByDefault
    : authorizer({ actor, action: "read", room });
  if (!allowed) {
    throw new LiveDraftRoomError("access_denied", "Only league members can view this draft room.");
  }
};

export const assertExpectedRevision = (
  room: LiveDraftRoom,
  expectedRevision: number | undefined,
): void => {
  if (expectedRevision !== undefined && expectedRevision !== room.revision) {
    throw new LiveDraftRoomError(
      "stale_revision",
      "Draft room changed since this action was prepared. Refresh and try again.",
    );
  }
};

export const assertIdempotencyKey = (idempotencyKey: string | undefined): void => {
  if (idempotencyKey === undefined || idempotencyKey.trim().length === 0) {
    throw new LiveDraftRoomError(
      "idempotency_key_required",
      "Draft room mutation requires an idempotency key.",
    );
  }
};

export const assertMutationMetadata = (input: MutateLiveDraftRoomInput): void => {
  if (input.expectedRevision === undefined || !Number.isInteger(input.expectedRevision)) {
    throw new LiveDraftRoomError(
      "expected_revision_required",
      "Draft room mutation requires the current revision.",
    );
  }
  assertIdempotencyKey(input.idempotencyKey);
};

export const assertRoomNotEnded = (room: LiveDraftRoom): void => {
  if (room.status === "ended") {
    throw new LiveDraftRoomError("room_already_ended", "Draft room has already ended.");
  }
};

export const assertRoomCanBeCancelled = (room: LiveDraftRoom): void => {
  const hasStartedOrDraftEvent = room.events.some(event =>
    event.type === "room_started"
    || event.type === "sale_logged"
    || event.type === "sale_corrected"
    || event.type === "sale_undone"
    || event.type === "pick_logged"
    || event.type === "pick_corrected"
    || event.type === "pick_undone"
  );
  if ((room.status !== "setup" && room.status !== "countdown") || hasStartedOrDraftEvent) {
    throw new LiveDraftRoomError(
      "room_not_cancellable",
      "Only a draft room that has never started can be cancelled.",
    );
  }
};

export const assertRoomCanStart = (room: LiveDraftRoom): void => {
  if (room.status === "live" || room.status === "paused") {
    throw new LiveDraftRoomError("room_already_live", "Draft room has already started.");
  }
};

export const assertRoomCanSynchronizeInitialRosters = (room: LiveDraftRoom): void => {
  if ((room.status !== "setup" && room.status !== "countdown")
    || room.events.some(event => event.type === "room_started")) {
    throw new LiveDraftRoomError(
      "room_already_live",
      "Keepers are locked after the live draft starts.",
    );
  }
};

export const assertRoomLive = (room: LiveDraftRoom): void => {
  if (room.status === "paused") {
    throw new LiveDraftRoomError("room_paused", "Resume the draft room before changing the draft.");
  }
  if (room.status !== "live") {
    throw new LiveDraftRoomError("room_not_live", "Start the draft room before recording selections.");
  }
};

export const assertRoomPaused = (room: LiveDraftRoom): void => {
  if (room.status !== "paused") {
    throw new LiveDraftRoomError("room_not_paused", "Only a paused draft room can be resumed.");
  }
};
