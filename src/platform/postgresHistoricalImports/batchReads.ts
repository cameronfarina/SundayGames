import type { HistoricalImportBatch } from "../historicalImports.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { batchFromRow } from "./batchCodec.js";
import { firstRow } from "./databaseResult.js";
import type { CountRow, HistoricalImportBatchRow } from "./rows.js";
import { selectBatchSql } from "./selectSql.js";

const batchResult = async (
  client: PostgresQueryClient,
  sql: string,
  values: readonly unknown[],
): Promise<HistoricalImportBatch | null> => {
  const row = firstRow(await client.query<HistoricalImportBatchRow>(sql, values));
  return row === undefined ? null : batchFromRow(row);
};

export const findBatchById = async (client: PostgresQueryClient, batchId: string) =>
  await batchResult(client, `${selectBatchSql} WHERE id = $1`, [batchId]);

export const findBatchByFileHash = async (
  client: PostgresQueryClient,
  leagueId: string,
  seasonYear: number,
  fileHash: string,
) => await batchResult(
  client,
  `${selectBatchSql} WHERE league_id = $1 AND season_year = $2 AND file_hash = $3 AND status <> 'superseded' ORDER BY created_at ASC, id ASC LIMIT 1`,
  [leagueId, seasonYear, fileHash],
);

export const findCommittedBatchByFileHash = async (
  client: PostgresQueryClient,
  leagueId: string,
  seasonYear: number,
  fileHash: string,
) => await batchResult(
  client,
  `${selectBatchSql} WHERE league_id = $1 AND season_year = $2 AND file_hash = $3 AND status = 'committed' ORDER BY created_at ASC, id ASC LIMIT 1`,
  [leagueId, seasonYear, fileHash],
);

export const findCurrentCommittedBatch = async (
  client: PostgresQueryClient,
  leagueId: string,
  seasonYear: number,
) => await batchResult(
  client,
  `${selectBatchSql} WHERE league_id = $1 AND season_year = $2 AND status = 'committed' ORDER BY committed_at DESC NULLS LAST, created_at DESC, id DESC LIMIT 1`,
  [leagueId, seasonYear],
);

const batchIdPrefix = (leagueId: string, seasonYear: number, fileHash: string): string =>
  `historical-import-${leagueId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${seasonYear}-${fileHash.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

export const nextBatchOrdinal = async (
  client: PostgresQueryClient,
  leagueId: string,
  seasonYear: number,
  fileHash: string,
): Promise<number> => {
  const prefix = batchIdPrefix(leagueId, seasonYear, fileHash);
  const result = await client.query<CountRow>(
    "SELECT COUNT(*)::integer AS count FROM historical_import_batches WHERE id LIKE $1",
    [`${prefix}-%`],
  );
  return Number(firstRow(result)?.count ?? 0) + 1;
};
