export const platformOnboardingQuery = `
SELECT
  l.id AS league_id,
  l.name AS league_name,
  ls.id AS season_id,
  ls.season_year,
  ls.status AS season_status,
  lm.role,
  ft.id AS team_id,
  ft.team_key,
  ft.team_name,
  ft.owner_name,
  dr.id AS room_id,
  dr.status AS room_status,
  COALESCE(dr.starts_at::text, ls.settings_json ->> 'draftScheduledAt') AS draft_scheduled_at
FROM league_memberships lm
JOIN leagues l ON l.id = lm.league_id
JOIN LATERAL (
  SELECT season.*
  FROM league_seasons season
  WHERE season.league_id = lm.league_id
  ORDER BY season.season_year DESC, season.created_at DESC
  LIMIT 1
) ls ON true
LEFT JOIN fantasy_teams ft
  ON ft.league_season_id = ls.id
  AND ft.owner_user_id = lm.user_id
LEFT JOIN LATERAL (
  SELECT room.*
  FROM draft_rooms room
  WHERE room.league_season_id = ls.id
    AND room.room_type = 'real'
  ORDER BY room.created_at DESC
  LIMIT 1
) dr ON true
WHERE lm.user_id = $1
  AND lm.status = 'active'
  AND l.archived_at IS NULL
ORDER BY l.name, ls.season_year DESC;
`.trim();
