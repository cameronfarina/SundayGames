import {
  espnPpr300AuctionBaseline2026Source,
  espnPpr300AuctionBaselineValueFor,
} from "../../../../data/espnPpr300AuctionBaseline2026.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../../../liveDraftRooms.js";

export type BaselineValueSource = "espn" | "mockd_projection";
export type BaselinePlayer = LiveDraftRoomPlayerCatalogEntry & {
  baselineValueSource: BaselineValueSource;
};

export interface BaselineMetadata {
  baselinePricingSource: typeof espnPpr300AuctionBaseline2026Source;
  pricingCoverage: {
    espnPlayerCount: number;
    fallbackPlayerCount: number;
    totalPlayerCount: number;
  };
}

const baselineValueSourceFor = (playerName: string): BaselineValueSource =>
  espnPpr300AuctionBaselineValueFor(playerName) === undefined ? "mockd_projection" : "espn";

export const playersWithBaselineSource = (
  players: readonly LiveDraftRoomPlayerCatalogEntry[],
): readonly BaselinePlayer[] => players.map(player => ({
  ...player,
  baselineValueSource: baselineValueSourceFor(player.name),
}));

export const baselineMetadataFor = (
  players: readonly BaselinePlayer[],
): BaselineMetadata => {
  const espnPlayerCount = players.filter(player => player.baselineValueSource === "espn").length;
  return {
    baselinePricingSource: espnPpr300AuctionBaseline2026Source,
    pricingCoverage: {
      espnPlayerCount,
      fallbackPlayerCount: players.length - espnPlayerCount,
      totalPlayerCount: players.length,
    },
  };
};
