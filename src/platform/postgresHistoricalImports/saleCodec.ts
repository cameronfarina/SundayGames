import { z } from "zod";
import type { HistoricalSaleRecord } from "../historicalImports.js";
import { historicalAcquisitionType, historicalPosition } from "./domainValues.js";
import type { HistoricalSaleRow } from "./rows.js";

const storedSaleSchema = z.object({
  id: z.string(),
  batchId: z.string(),
  leagueId: z.string(),
  leagueSeasonId: z.string(),
  seasonYear: z.number(),
  rowNumber: z.number(),
  ownerId: z.string(),
  ownerDisplayName: z.string(),
  playerId: z.string(),
  playerName: z.string(),
  position: z.string(),
  priceDollars: z.number(),
  publicPriceDollars: z.number().optional(),
  keeper: z.boolean(),
  acquisitionType: z.string(),
});

export const saleRecordFromUnknown = (value: unknown): HistoricalSaleRecord | null => {
  const parsed = storedSaleSchema.safeParse(value);
  if (!parsed.success) return null;
  const sale = parsed.data;
  return {
    id: sale.id,
    batchId: sale.batchId,
    leagueId: sale.leagueId,
    leagueSeasonId: sale.leagueSeasonId,
    seasonYear: sale.seasonYear,
    rowNumber: sale.rowNumber,
    ownerId: sale.ownerId,
    ownerDisplayName: sale.ownerDisplayName,
    playerId: sale.playerId,
    playerName: sale.playerName,
    position: historicalPosition(sale.position),
    priceDollars: sale.priceDollars,
    ...(sale.publicPriceDollars === undefined
      ? {}
      : { publicPriceDollars: sale.publicPriceDollars }),
    keeper: sale.keeper,
    acquisitionType: historicalAcquisitionType(sale.acquisitionType),
  };
};

export const saleRecordFromRow = (row: HistoricalSaleRow): HistoricalSaleRecord => ({
  id: row.id,
  batchId: row.import_batch_id,
  leagueId: row.league_id,
  leagueSeasonId: row.league_season_id,
  seasonYear: Number(row.season_year),
  rowNumber: Number(row.row_number),
  ownerId: row.owner_id,
  ownerDisplayName: row.owner_display_name,
  playerId: row.player_id,
  playerName: row.player_name,
  position: historicalPosition(row.position),
  priceDollars: Number(row.price_dollars),
  ...(row.public_price_dollars === null
    ? {}
    : { publicPriceDollars: Number(row.public_price_dollars) }),
  keeper: row.keeper,
  acquisitionType: historicalAcquisitionType(row.acquisition_type),
});
