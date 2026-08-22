export const accountDashboardQuery = `
SELECT
  l.id AS league_id,
  l.name AS league_name,
  l.slug AS league_slug,
  COALESCE(l.provider, 'mockd') AS provider,
  ls.id AS season_id,
  ls.season_year,
  ls.status AS season_status,
  lm.role AS membership_role,
  ft.id AS team_id,
  ft.team_name,
  COALESCE(rrs.draft_format, 'auction') AS draft_format,
  teams.team_count,
  room.id AS room_id,
  room.status AS room_status,
  COALESCE(
    room.starts_at::text,
    ls.settings_json #>> '{draft,scheduledAt}',
    ls.settings_json ->> 'draftScheduledAt'
  ) AS draft_starts_at,
  ls.settings_json #>> '{draft,timezone}' AS draft_timezone,
  history.historical_import_seasons,
  mocks.completed_mocks,
  simulations.simulation_runs,
  simulations.simulations_completed,
  simulations.saved_simulation_outcomes
FROM league_memberships lm
JOIN leagues l ON l.id = lm.league_id
JOIN LATERAL (
  SELECT season.* FROM league_seasons season
  WHERE season.league_id = lm.league_id
  ORDER BY season.season_year DESC, season.created_at DESC
  LIMIT 1
) ls ON true
LEFT JOIN roster_rule_sets rrs ON rrs.league_season_id = ls.id
LEFT JOIN fantasy_teams ft
  ON ft.league_season_id = ls.id AND ft.owner_user_id = lm.user_id
JOIN LATERAL (
  SELECT COUNT(*) AS team_count FROM fantasy_teams team WHERE team.league_season_id = ls.id
) teams ON true
LEFT JOIN LATERAL (
  SELECT draft_room.* FROM draft_rooms draft_room
  WHERE draft_room.league_season_id = ls.id AND draft_room.room_type = 'real'
  ORDER BY draft_room.created_at DESC
  LIMIT 1
) room ON true
JOIN LATERAL (
  SELECT COUNT(DISTINCT batch.season_year) AS historical_import_seasons
  FROM historical_import_batches batch
  WHERE batch.league_id = l.id AND batch.status = 'committed'
) history ON true
JOIN LATERAL (
  SELECT COUNT(*) AS completed_mocks FROM mock_sessions mock
  WHERE mock.user_id = $1
    AND mock.league_season_id = ls.id
    AND mock.status = 'completed'
    AND mock.completed_at >= NOW() - INTERVAL '24 hours'
) mocks ON true
JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE simulation.status = 'completed') AS simulation_runs,
    COALESCE(SUM(COALESCE((simulation.request_json ->> 'count')::integer, 1))
      FILTER (WHERE simulation.status = 'completed'), 0) AS simulations_completed,
    COALESCE(SUM(CASE
      WHEN simulation.status = 'completed'
        AND jsonb_typeof(result.result_set_json -> 'favoriteRunNumbers') = 'array'
      THEN jsonb_array_length(result.result_set_json -> 'favoriteRunNumbers')
      ELSE 0
    END), 0) AS saved_simulation_outcomes
  FROM simulation_runs simulation
  LEFT JOIN simulation_results result ON result.simulation_run_id = simulation.id
  WHERE simulation.user_id = $1 AND simulation.league_season_id = ls.id
) simulations ON true
WHERE lm.user_id = $1
  AND lm.status = 'active'
  AND l.archived_at IS NULL
ORDER BY l.name ASC, ls.season_year DESC;
`.trim();
