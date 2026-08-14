import type { LiveDraftRoom } from "./liveDraftSchemas";

export type LiveDraftRoomEventName =
  | "room.snapshot"
  | "room.sale"
  | "room.started"
  | "room.paused"
  | "room.resumed"
  | "room.ended"
  | "room.error";

export const liveDraftRoomEventNames: readonly LiveDraftRoomEventName[] = [
  "room.snapshot",
  "room.sale",
  "room.started",
  "room.paused",
  "room.resumed",
  "room.ended",
  "room.error",
];

export type LiveDraftRoomCacheUpdate =
  | { type: "applied"; room: LiveDraftRoom }
  | { type: "ignored" }
  | { type: "refetch" };

const eventMatchesRoom = (
  event: LiveDraftRoomEventName,
  room: LiveDraftRoom,
): boolean => {
  switch (event) {
    case "room.snapshot":
      return true;
    case "room.sale":
    case "room.started":
    case "room.resumed":
      return room.status === "live";
    case "room.paused":
      return room.status === "paused";
    case "room.ended":
      return room.status === "ended";
    case "room.error":
      return false;
  }
};

export const liveDraftRoomCacheUpdate = (
  current: LiveDraftRoom | undefined,
  event: LiveDraftRoomEventName,
  incoming: LiveDraftRoom,
): LiveDraftRoomCacheUpdate => {
  if (
    incoming.connection.revision !== incoming.revision ||
    incoming.connection.cursor !== `${incoming.roomId}:${String(incoming.revision)}`
  ) {
    return { type: "refetch" };
  }
  if (current !== undefined && incoming.roomId !== current.roomId) return { type: "refetch" };
  if (!eventMatchesRoom(event, incoming)) return { type: "refetch" };
  if (current === undefined) return { type: "refetch" };
  if (incoming.revision <= current.revision) return { type: "ignored" };
  if (event === "room.snapshot") return { type: "applied", room: incoming };
  if (incoming.revision !== current.revision + 1) return { type: "refetch" };

  return { type: "applied", room: incoming };
};
