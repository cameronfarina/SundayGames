export const upsertItemSql = `
INSERT INTO player_news_items (
  id, provider, provider_item_id, canonical_url, player_name, title, summary,
  published_at, fetched_at, tags_json, created_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $9)
ON CONFLICT (provider, provider_item_id) DO UPDATE SET
  canonical_url = EXCLUDED.canonical_url,
  player_name = EXCLUDED.player_name,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  published_at = EXCLUDED.published_at,
  fetched_at = EXCLUDED.fetched_at,
  tags_json = EXCLUDED.tags_json
`.trim();

export const selectRecentItemsSql = `
SELECT id, provider, provider_item_id, canonical_url, player_name, title, summary, published_at, fetched_at, tags_json
FROM player_news_items
WHERE COALESCE(published_at, fetched_at) >= $1
ORDER BY COALESCE(published_at, fetched_at) DESC
`.trim();

export const deleteItemsOlderThanSql = `
DELETE FROM player_news_items
WHERE COALESCE(published_at, fetched_at) < $1
`.trim();
