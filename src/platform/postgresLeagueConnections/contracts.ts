export interface LeagueConnectionRow {
  id: string;
  account_id: string;
  provider: string;
  provider_league_id: string;
  season: string;
  display_name: string;
  status: string;
  status_detail: string | null;
  last_synced_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface LeagueConnectionCredentialRow {
  espn_s2: string | null;
  swid: string | null;
}

export interface LeagueConnectionSnapshotRow {
  connection_id: string;
  settings_json: unknown;
  teams_json: unknown;
  matchups_json: unknown;
  synced_at: Date | string;
}

export interface ProviderPlayerDirectoryRow {
  provider: string;
  entries_json: unknown;
  fetched_at: Date | string;
}
