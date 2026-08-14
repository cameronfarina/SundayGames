import type { HistoricalSaleRecord } from "../historicalImports.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type { HistoricalSaleRow } from "./rows.js";
import { saleRecordFromRow } from "./saleCodec.js";
import { selectSaleSql } from "./selectSql.js";

const currentRecordsSql = (throughSeason: boolean): string => `
${selectSaleSql}
JOIN historical_import_batches b ON b.id = historical_draft_sales.import_batch_id
WHERE historical_draft_sales.league_id = $1
  AND historical_draft_sales.season_year ${throughSeason ? "<=" : "="} $2
  AND b.status = 'committed'
ORDER BY historical_draft_sales.season_year ASC, historical_draft_sales.row_number ASC, historical_draft_sales.id ASC
`.trim();

const readRecords = async (
  client: PostgresQueryClient,
  leagueId: string,
  seasonYear: number,
  throughSeason: boolean,
): Promise<HistoricalSaleRecord[]> => {
  const result = await client.query<HistoricalSaleRow>(
    currentRecordsSql(throughSeason),
    [leagueId, seasonYear],
  );
  return result.rows.map(saleRecordFromRow);
};

export const currentRecords = async (
  client: PostgresQueryClient,
  leagueId: string,
  seasonYear: number,
) => await readRecords(client, leagueId, seasonYear, false);

export const currentRecordsThroughSeason = async (
  client: PostgresQueryClient,
  leagueId: string,
  seasonYear: number,
) => await readRecords(client, leagueId, seasonYear, true);
