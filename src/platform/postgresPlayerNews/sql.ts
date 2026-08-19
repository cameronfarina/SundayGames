// Postgres caps a statement at 65535 bind parameters. Batching keeps a news
// refresh to a single round-trip instead of one statement per item, which is
// what used to run while a reader waited on the page.
export const playerNewsUpsertBatchSize = 200;

const jsonbColumns = new Set(["tags_json", "categories_json"]);

const placeholder = (column: string, index: number): string =>
  jsonbColumns.has(column) ? `$${index}::jsonb` : `$${index}`;

export const playerNewsColumns: readonly string[] = [
  "id", "provider", "provider_item_id", "canonical_url", "player_name", "title",
  "summary", "published_at", "fetched_at", "tags_json", "categories_json",
  "analyst_impact", "provider_player_id", "provider_team_id", "created_at",
];

// The row keeps whichever id it was first stored under, so a re-published item
// does not change identity for anything already holding it.
const preservedColumns = new Set(["id", "provider", "provider_item_id", "created_at"]);

const valuesTuples = (rowCount: number): string =>
  Array.from({ length: rowCount }, (_unused, rowIndex) =>
    `(${playerNewsColumns.map((column, columnIndex) =>
      placeholder(column, rowIndex * playerNewsColumns.length + columnIndex + 1)).join(", ")})`)
    .join(", ");

export const upsertItemsSql = (rowCount: number): string => `
INSERT INTO player_news_items (${playerNewsColumns.join(", ")})
VALUES ${valuesTuples(rowCount)}
ON CONFLICT (provider, provider_item_id) DO UPDATE SET
  ${playerNewsColumns
    .filter(column => !preservedColumns.has(column))
    .map(column => `${column} = EXCLUDED.${column}`)
    .join(",\n  ")}
`.trim();

export const selectRecentItemsSql = `
SELECT ${playerNewsColumns.filter(column => column !== "created_at").join(", ")}
FROM player_news_items
WHERE COALESCE(published_at, fetched_at) >= $1
ORDER BY COALESCE(published_at, fetched_at) DESC
`.trim();

export const deleteItemsOlderThanSql = `
DELETE FROM player_news_items
WHERE COALESCE(published_at, fetched_at) < $1
`.trim();
