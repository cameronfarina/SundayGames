export interface HistoricalImportBatchRow {
  id: string;
  league_id: string;
  league_season_id: string | null;
  season_year: number;
  uploaded_by_user_id: string;
  file_hash: string;
  status: string;
  replacement_requested: boolean;
  mapping_json: unknown;
  warnings_json: unknown;
  blockers_json: unknown;
  created_at: Date | string;
  committed_at: Date | string | null;
  superseded_at: Date | string | null;
  superseded_by_batch_id: string | null;
}

export interface HistoricalSaleRow {
  id: string;
  league_id: string;
  league_season_id: string;
  season_year: number;
  import_batch_id: string;
  owner_id: string;
  owner_display_name: string;
  player_id: string;
  player_name: string;
  position: string;
  price_dollars: number;
  public_price_dollars: number | null;
  keeper: boolean;
  acquisition_type: string;
  row_number: number;
}

export interface CountRow {
  count: string | number;
}
