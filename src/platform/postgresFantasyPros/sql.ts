// Postgres caps a statement at 65535 bind parameters, and a players refresh
// carries roughly 8,500 rows. Batching keeps each refresh to a handful of
// round-trips instead of one per row.
export const fantasyProsUpsertBatchSize = 500;

const jsonbColumns = new Set(["positions_json"]);

const placeholder = (column: string, index: number): string =>
  jsonbColumns.has(column) ? `$${index}::jsonb` : `$${index}`;

const valuesTuples = (columns: readonly string[], rowCount: number): string =>
  Array.from({ length: rowCount }, (_unused, rowIndex) =>
    `(${columns.map((column, columnIndex) =>
      placeholder(column, rowIndex * columns.length + columnIndex + 1)).join(", ")})`).join(", ");

const excludedAssignments = (columns: readonly string[]): string =>
  columns.map(column => `${column} = EXCLUDED.${column}`).join(",\n  ");

const upsertSql = (
  table: string,
  columns: readonly string[],
  conflictColumns: readonly string[],
  rowCount: number,
): string => {
  const updatable = columns.filter(column => !conflictColumns.includes(column));
  return `
INSERT INTO ${table} (${columns.join(", ")})
VALUES ${valuesTuples(columns, rowCount)}
ON CONFLICT (${conflictColumns.join(", ")}) DO UPDATE SET
  ${excludedAssignments(updatable)}
`.trim();
};

export const rankingColumns: readonly string[] = [
  "ranking_type", "scoring", "week", "player_id", "player_name", "player_position",
  "player_team", "yahoo_id", "rank_ecr", "rank_min", "rank_max", "rank_average",
  "rank_standard_deviation", "tier", "position_rank", "bye_week", "ecr_delta",
  "owned_average", "owned_espn", "owned_yahoo", "fetched_at",
];

export const projectionColumns: readonly string[] = [
  "week", "player_id", "player_name", "player_position", "player_team", "points",
  "points_ppr", "passing_yards", "passing_touchdowns", "interceptions",
  "rushing_yards", "rushing_touchdowns", "receptions", "receiving_yards",
  "receiving_touchdowns", "fetched_at",
];

export const playerColumns: readonly string[] = [
  "player_id", "player_name", "first_name", "last_name", "short_name",
  "player_position", "positions_json", "player_team", "sportsdata_id", "fetched_at",
];

export const upsertRankingsSql = (rowCount: number): string =>
  upsertSql("fantasy_pros_rankings", rankingColumns, ["ranking_type", "scoring", "week", "player_id"], rowCount);

export const upsertProjectionsSql = (rowCount: number): string =>
  upsertSql("fantasy_pros_projections", projectionColumns, ["week", "player_id"], rowCount);

export const upsertPlayersSql = (rowCount: number): string =>
  upsertSql("fantasy_pros_players", playerColumns, ["player_id"], rowCount);

export const selectRankingsSql = `
SELECT ${rankingColumns.join(", ")}
FROM fantasy_pros_rankings
WHERE ranking_type = $1 AND ($2::integer IS NULL OR week = $2)
ORDER BY rank_ecr
`.trim();

export const selectProjectionsSql = `
SELECT ${projectionColumns.join(", ")}
FROM fantasy_pros_projections
WHERE week = $1 AND ($2::text IS NULL OR player_position = $2)
ORDER BY points_ppr DESC NULLS LAST
`.trim();

export const selectPlayersSql = `
SELECT ${playerColumns.join(", ")}
FROM fantasy_pros_players
ORDER BY player_id
`.trim();

// The cadence comparison runs against the stored timestamp so two instances
// racing through a zero-downtime deploy cannot both claim the same dataset.
export const claimRefreshSql = `
INSERT INTO fantasy_pros_fetch_log (dataset, last_fetched_at, created_at, updated_at)
VALUES ($1, $2, $2, $2)
ON CONFLICT (dataset) DO UPDATE SET
  last_fetched_at = EXCLUDED.last_fetched_at,
  updated_at = EXCLUDED.updated_at
WHERE fantasy_pros_fetch_log.last_fetched_at < $3
RETURNING dataset
`.trim();

export const recordRefreshOutcomeSql = `
UPDATE fantasy_pros_fetch_log SET
  request_count = request_count + $2,
  row_count = COALESCE($3::integer, row_count),
  last_succeeded_at = CASE WHEN $4::text IS NULL THEN $5 ELSE last_succeeded_at END,
  last_error = $4,
  updated_at = $5
WHERE dataset = $1
`.trim();

export const selectFetchLogSql = `
SELECT dataset, last_fetched_at, last_succeeded_at, request_count, row_count, last_error
FROM fantasy_pros_fetch_log
ORDER BY dataset
`.trim();
