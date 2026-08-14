export const selectBatchSql = `
SELECT
  id,
  league_id,
  league_season_id,
  season_year,
  uploaded_by_user_id,
  file_hash,
  status,
  replacement_requested,
  mapping_json,
  warnings_json,
  blockers_json,
  created_at,
  committed_at,
  superseded_at,
  superseded_by_batch_id
FROM historical_import_batches
`.trim();

export const selectSaleSql = `
SELECT
  historical_draft_sales.id,
  historical_draft_sales.league_id,
  historical_draft_sales.league_season_id,
  historical_draft_sales.season_year,
  historical_draft_sales.import_batch_id,
  historical_draft_sales.owner_id,
  historical_draft_sales.owner_display_name,
  historical_draft_sales.player_id,
  historical_draft_sales.player_name,
  historical_draft_sales.position,
  historical_draft_sales.price_dollars,
  historical_draft_sales.public_price_dollars,
  historical_draft_sales.keeper,
  historical_draft_sales.acquisition_type,
  historical_draft_sales.row_number
FROM historical_draft_sales
`.trim();
