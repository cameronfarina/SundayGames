import type { HistoricalSaleRecord } from "../historicalImports.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { insertSaleSql } from "./insertSaleSql.js";

const ensurePlayerSql = `
INSERT INTO players (id, canonical_name, position)
VALUES ($1, $2, $3)
ON CONFLICT (id) DO NOTHING;
`.trim();

export const addRecords = async (
  client: PostgresQueryClient,
  records: readonly HistoricalSaleRecord[],
): Promise<void> => {
  const referencedPlayers = new Map(
    records.map(record => [record.playerId, record]),
  );
  for (const player of referencedPlayers.values()) {
    await client.query(ensurePlayerSql, [player.playerId, player.playerName, player.position]);
  }
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
