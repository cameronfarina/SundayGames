import type { LiveDraftRoom, LiveDraftRoomEvent } from "../liveDraftRooms.js";

export interface DraftRoomSnapshotRow {
  draft_room_id?: string;
  snapshot_json: unknown;
}

export interface DraftRoomEventPersistenceRow {
  id: string;
  draft_room_id: string;
  revision: number;
  event_type: LiveDraftRoomEvent["type"];
  actor_user_id: string;
  idempotency_key: string | null;
  mutation_hash: string | null;
  payload_json: unknown;
  occurred_at: Date;
}

export interface CompactDraftRoomSnapshotV2 {
  formatVersion: 2;
  room: {
    status: LiveDraftRoom["status"];
    revision: number;
    updatedAt: string;
    endedAt: string | null;
  };
}

export interface RevisionUpdateRow {
  current_revision: number;
}

export interface StartedRoomRow {
  has_started_room: boolean;
}

export interface RoomExistsRow {
  has_room: boolean;
}

export interface DeletedRoomRow {
  id: string;
}
