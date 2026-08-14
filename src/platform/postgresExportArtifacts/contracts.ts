export interface DraftRoomExportRow {
  id: string;
  league_id: string;
  league_season_id: string;
  draft_room_id: string;
  artifact_type: string;
  storage_key: string | null;
  payload_hash: string;
  content_type: string;
  byte_length: number;
  source_revision: number;
  created_at: Date | string;
}

export interface DraftRoomExportWithContentRow extends DraftRoomExportRow {
  content_base64: string;
}
