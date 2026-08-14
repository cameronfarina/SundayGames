import type { HistoricalSaleRecord } from "../historicalImports.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { insertSaleSql } from "./insertSaleSql.js";

export const addRecords = async (
  client: PostgresQueryClient,
  records: readonly HistoricalSaleRecord[],
): Promise<void> => {
  for (const record of records) {
    await client.query(insertSaleSql, [
      record.id,
      record.leagueId,
      record.leagueSeasonId,
      record.seasonYear,
      record.batchId,
      record.ownerId,
      record.ownerDisplayName,
      record.playerId,
      record.playerName,
      record.position,
      record.priceDollars,
      record.publicPriceDollars ?? null,
      record.keeper,
      record.acquisitionType,
      record.rowNumber,
    ]);
  }
};
