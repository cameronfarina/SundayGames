export const selectItemsSql = `
SELECT
  i.id,
  l.league_id,
  l.league_season_id,
  l.user_id,
  i.player_name,
  i.position,
  i.max_bid,
  i.priority,
  i.created_at,
  i.updated_at
FROM target_list_items i
JOIN target_lists l ON l.id = i.target_list_id
`.trim();

export const selectActiveListSql = `
SELECT id
FROM target_lists
WHERE user_id = $1 AND league_season_id = $2 AND status = 'active' AND name = $3
ORDER BY created_at ASC
LIMIT 1
`.trim();

export const insertListSql = `
INSERT INTO target_lists (
  id, league_id, league_season_id, user_id, name, status, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, 'active', $6, $6)
`.trim();

export const selectExistingItemSql = `
SELECT id
FROM target_list_items
WHERE target_list_id = $1 AND lower(player_name) = lower($2)
LIMIT 1
`.trim();

export const insertItemSql = `
INSERT INTO target_list_items (
  id, target_list_id, player_name, position, max_bid, priority, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
`.trim();

export const updateItemSql = `
UPDATE target_list_items
SET player_name = $2, position = $3, max_bid = $4, updated_at = $5
WHERE id = $1
`.trim();

export const removeItemSql = `
DELETE FROM target_list_items i
USING target_lists l
WHERE i.target_list_id = l.id
  AND l.user_id = $1
  AND l.league_season_id = $2
  AND l.status = 'active'
  AND lower(i.player_name) = lower($3)
  AND l.name = $4
RETURNING i.id
`.trim();
