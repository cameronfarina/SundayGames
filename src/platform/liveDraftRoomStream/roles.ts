import type { LiveDraftRoom } from "../liveDraftRooms.js";
import type {
  LiveDraftRoomStreamActor,
  LiveDraftRoomViewerRole,
} from "./contracts/readModel.js";

const actorCanWrite = (actor: LiveDraftRoomStreamActor): boolean =>
  actor.role === "owner" || actor.role === "admin";

export const roleFor = (
  room: LiveDraftRoom,
  actor: LiveDraftRoomStreamActor,
): LiveDraftRoomViewerRole => {
  if (actor.role === "observer") return "observer";
  if (actor.userId === room.commissionerUserId || actorCanWrite(actor)) return "commissioner";

  return "member";
};

export const canMutateRoomFor = (role: LiveDraftRoomViewerRole): boolean =>
  role === "commissioner";
