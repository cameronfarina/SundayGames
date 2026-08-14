import {
  createPricingSnapshot,
  hashPricingSnapshotInputs,
  type PricingSourcePrice,
} from "../../src/platform/pricingSnapshots.js";

export const sourcePrices: readonly PricingSourcePrice[] = [
  {
    name: "Bijan Robinson",
    normalizedName: "bijan robinson",
    position: "RB",
    price: 69,
    scenarioPrice: 74,
    livePrice: 77,
    personalValue: 82,
    recommendedMaxBid: 79,
    confidence: 0.91,
    tier: "elite",
    warnings: ["keeper inflation"],
  },
  {
    name: "Puka Nacua",
    normalizedName: "puka nacua",
    position: "WR",
    price: 68,
    scenarioPrice: 70,
    livePrice: 72,
    personalValue: 76,
    recommendedMaxBid: 73,
    confidence: 0.87,
    tier: "elite",
  },
];

export const createExpectedSnapshot = () => createPricingSnapshot({
  leagueId: "league-100001",
  seasonYear: 2026,
  modelVersion: "auction-v1",
  scenarioId: "expected",
  inputSnapshot: {
    id: "input-snapshot-2026-expected",
    hash: hashPricingSnapshotInputs({ scenarioId: "expected" }),
  },
  prices: sourcePrices,
});
