import { highPriceThresholds, priceTierCountThresholds, priceTiers } from "./constants.js";
import type { HistoricalBacktestGate, HistoricalSeasonShape } from "./contracts.js";
import { backtestGate, countFor } from "./gateCore.js";

export const baseGates = (
  actual: HistoricalSeasonShape,
  baseline: HistoricalSeasonShape,
): HistoricalBacktestGate[] => [
  backtestGate({
    key: "open-auction-spend",
    category: "open_auction_spend",
    label: "Open auction spend",
    target: baseline.openAuctionSpend,
    actual: actual.openAuctionSpend,
    warnThreshold: 75,
    failThreshold: 125,
  }),
  backtestGate({
    key: "auction-player-count",
    category: "auction_player_count",
    label: "Auction player count",
    target: baseline.auctionPlayerCount,
    actual: actual.auctionPlayerCount,
    warnThreshold: 2,
    failThreshold: 4,
  }),
  ...highPriceThresholds.map(threshold => backtestGate({
    key: `high-price-volume:${threshold}-plus`,
    category: "high_price_volume",
    label: `$${threshold}+ player count`,
    target: countFor(baseline.highPriceCounts, `${threshold}-plus`),
    actual: countFor(actual.highPriceCounts, `${threshold}-plus`),
    warnThreshold: 1,
    failThreshold: 3,
  })),
  ...priceTiers.map(tier => {
    const thresholds = priceTierCountThresholds[tier.key];
    return backtestGate({
      key: `price-tier-count:${tier.key}`,
      category: "price_tier_count",
      label: tier.key === "dollar" ? "$1 player count" : `${tier.label} player count`,
      target: countFor(baseline.priceTierCounts, tier.key),
      actual: countFor(actual.priceTierCounts, tier.key),
      warnThreshold: thresholds.warn,
      failThreshold: thresholds.fail,
    });
  }),
];
