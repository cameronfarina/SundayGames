export const selectLeagueSeasonSql = `
SELECT
  s.id,
  s.league_id,
  s.season_year,
  s.name,
  s.status,
  s.settings_json,
  l.name AS league_name,
  l.provider,
  l.provider_league_id,
  r.draft_format,
  r.budget,
  r.minimum_bid,
  r.snake_json,
  r.slots_json,
  r.position_maximums_json,
  r.scoring_json
FROM league_seasons s
JOIN leagues l ON l.id = s.league_id
LEFT JOIN roster_rule_sets r ON r.league_season_id = s.id
`.trim();
