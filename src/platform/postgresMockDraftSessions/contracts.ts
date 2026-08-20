export interface MockDraftSessionRow {
  id: string;
  league_id: string;
  league_season_id: string;
  user_id: string;
  owner_id: string;
  team_id: string;
  status: string;
  revision: number;
  command_count: number;
  draft_mode_json: unknown;
  configuration_snapshot_json: unknown;
  latest_result_ref_json: unknown;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  abandoned_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  command_log_json: unknown;
}

export interface MockDraftSessionOwnerRow {
  user_id: string;
}
