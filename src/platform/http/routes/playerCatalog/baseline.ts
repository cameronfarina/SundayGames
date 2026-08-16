import {
  espnPpr300AuctionBaseline2026,
  espnPpr300AuctionBaseline2026Source,
  espnPpr300AuctionBaselineValueFor,
} from "../../../../data/espnPpr300AuctionBaseline2026.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../../../liveDraftRooms.js";

export type BaselineValueSource = "espn" | "mockd_projection";
export type BaselinePlayer = LiveDraftRoomPlayerCatalogEntry & {
  baselineValueSource: BaselineValueSource;
  marketRank: number;
};

export interface BaselineMetadata {
  baselinePricingSource: typeof espnPpr300AuctionBaseline2026Source;
  pricingCoverage: {
    espnPlayerCount: number;
    fallbackPlayerCount: number;
    totalPlayerCount: number;
  };
}

export const playersWithBaselineSource = (
  players: readonly LiveDraftRoomPlayerCatalogEntry[],
): readonly BaselinePlayer[] => {
  let fallbackRank = espnPpr300AuctionBaseline2026.length;
  return players.map(player => {
    const baseline = espnPpr300AuctionBaselineValueFor(player.name);
    if (baseline !== undefined) {
      return {
        ...player,
        baselineValueSource: "espn",
        marketPrice: baseline.auctionValue,
        marketRank: baseline.overallRank,
      };
    }
    fallbackRank += 1;
    return {
      ...player,
      baselineValueSource: "mockd_projection",
      marketPrice: player.marketPrice ?? player.expectedPrice,
      marketRank: fallbackRank,
    };
  });
};

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
