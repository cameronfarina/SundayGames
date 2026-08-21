

export interface StoredSnapshotRow {
  revision: number;
  snapshot_json: unknown;
}

export interface StoredAuthAccountRow {
  id: string;
  email: string;
  email_normalized: string;
  password_hash: string;
  email_verified_at: Date | null;
  auth_version: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface StoredAuthSessionRow {
  id: string;
  account_id: string;
  token_hash: string;
  auth_version: number;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
}

export interface DraftRoomRow {
  id: string;
  league_id: string;
  league_season_id: string;
  room_type: string;
  status: string;
  created_by_user_id: string;
  current_revision: number;
  starts_at: Date | null;
  started_at: Date | null;
  ended_at: Date | null;
  created_at: Date;
  updated_at: Date;
  current_projection_json: unknown | null;
}

export interface DraftRoomEventRow {
  id: string;
  draft_room_id: string;
  revision: number;
  sequence: number;
  event_type: string;
  actor_user_id: string;
  idempotency_key: string | null;
  mutation_hash: string | null;
  expected_revision: number | null;
  raw_command: string | null;
  payload_json: unknown;
  occurred_at: Date;
}

export interface DraftRoomSnapshotRow {
  id: string;
  draft_room_id: string;
  revision: number;
  snapshot_json: unknown;
  snapshot_hash: string;
  created_at: Date;
}

export interface DraftRoomSaleRow {
  id: string;
  draft_room_id: string;
  source_event_id: string;
  fantasy_team_id: string;
  player_name: string;
  normalized_player_name: string;
  position: string;
  price: number;
  expected_price: number | null;
  status: string;
  voided_by_event_id: string | null;
  created_at: Date;
}

export interface DraftRoomExportRow {
  id: string;
  league_id: string;
  league_season_id: string;
  draft_room_id: string;
  created_by_user_id: string;
  artifact_type: string;
  status: string;
  storage_key: string | null;
  payload_hash: string;
  content_type: string;
  byte_length: number;
  source_revision: number;
  metadata_json: unknown;
  created_at: Date;
  completed_at: Date | null;
}

export interface DraftRoomExportContentRow {
  id: string;
  artifact_id: string;
  content_base64: string;
  created_at: Date;
}

export interface InsertGate {
  entered: () => void;
  release: Promise<void>;
}
