export const insertSaleSql = `
INSERT INTO historical_draft_sales (
  id,
  league_id,
  league_season_id,
  season_year,
  import_batch_id,
  fantasy_team_id,
  owner_id,
  owner_display_name,
  player_id,
  player_name,
  position,
  price_dollars,
  public_price_dollars,
  keeper,
  acquisition_type,
  row_number
) VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
ON CONFLICT ON CONSTRAINT historical_draft_sales_batch_row_key DO NOTHING;
`.trim();
