import type { LiveDraftRoomEvent } from "../../liveDraftRooms.js";
import type { LiveDraftRoomSseEventName } from "../contracts/sse.js";

export const eventNameFor = (event: LiveDraftRoomEvent): LiveDraftRoomSseEventName => {
  switch (event.type) {
    case "room_created":
    case "initial_rosters_synchronized":
    case "room_reopened":
    case "sale_corrected":
    case "sale_undone":
    case "pick_logged":
    case "pick_corrected":
    case "pick_undone":
      return "room.snapshot";
    case "room_started":
      return "room.started";
    case "sale_logged":
      return "room.sale";
    case "room_paused":
      return "room.paused";
    case "room_resumed":
      return "room.resumed";
    case "room_ended":
      return "room.ended";
  }
};
