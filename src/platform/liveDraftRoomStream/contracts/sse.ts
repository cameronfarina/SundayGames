import type { LiveDraftRoom, LiveDraftRoomEvent } from "../../liveDraftRooms.js";
import type {
  LiveDraftRoomReadModel,
  LiveDraftRoomSaleLogEntry,
  LiveDraftRoomStreamActor,
} from "./readModel.js";

export type LiveDraftRoomSseEventName =
  | "room.snapshot"
  | "room.sale"
  | "room.started"
  | "room.paused"
  | "room.resumed"
  | "room.ended"
  | "room.error";

export type LiveDraftRoomCacheSseEventName = Exclude<LiveDraftRoomSseEventName, "room.error">;

export type LiveDraftRoomSsePayload =
  | {
    id: string;
    event: "room.snapshot";
    revision: number;
    retry: number;
    data: LiveDraftRoomReadModel;
  }
  | {
    id: string;
    event: "room.sale";
    revision: number;
    data: {
      roomId: string;
      leagueId: string;
      seasonId: string;
      status: "live";
      revision: number;
      occurredAt: string;
      sale: LiveDraftRoomSaleLogEntry;
    };
  }
  | {
    id: string;
    event: "room.started" | "room.paused" | "room.resumed" | "room.ended";
    revision: number;
    data: {
      roomId: string;
      leagueId: string;
      seasonId: string;
      status: "live" | "paused" | "ended";
      revision: number;
      occurredAt: string;
    };
  }
  | {
    id: string;
    event: "room.error";
    revision: number;
    data: {
      roomId: string;
      leagueId: string;
      seasonId: string;
      code: "future_revision";
      message: string;
      currentRevision: number;
      requestedRevision: number;
    };
  };

export interface BuildLiveDraftRoomSseEventInput {
  room: LiveDraftRoom;
  event: LiveDraftRoomEvent;
  actor: LiveDraftRoomStreamActor;
}

export interface LiveDraftRoomEventsAfterRevisionInput {
  room: LiveDraftRoom;
  actor: LiveDraftRoomStreamActor;
  afterRevision: number;
}

export interface LiveDraftRoomEventsAfterRevisionResult {
  currentRevision: number;
  isStale: boolean;
  requiresSnapshot: boolean;
  events: readonly LiveDraftRoomSsePayload[];
}

export interface LiveDraftRoomCacheSsePayload {
  id: string;
  event: LiveDraftRoomCacheSseEventName;
  revision: number;
  retry?: number | undefined;
  data: LiveDraftRoomReadModel;
}

export interface FormattableLiveDraftRoomSsePayload {
  id: string;
  event: LiveDraftRoomSseEventName;
  retry?: number | undefined;
  data: unknown;
}
