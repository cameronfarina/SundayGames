import type { ThreeRbAuctionVariant } from "./internalContracts.js";

const hashDivisor = 0x100000000;

const defaultVariant: ThreeRbAuctionVariant = {
  rbCoreBudget: {
    hardBudget: 158,
    minimumFutureCorePrice: 14,
  },
  rbSlotMaxBids: [76, 76, 76, 8, 4],
  rbDemandMultiplier: 1.26,
  priceAggression: 1.07,
  scarcityChase: 1.17,
  replacementPatience: 0.96,
  anchorAggression: 1.38,
  depthAggression: 0.92,
};

const threeRbAuctionVariants: readonly ThreeRbAuctionVariant[] = [
  defaultVariant,
  {
    rbCoreBudget: {
      hardBudget: 152,
      minimumFutureCorePrice: 14,
    },
    rbSlotMaxBids: [76, 76, 76, 8, 4],
    rbDemandMultiplier: 1.34,
    priceAggression: 1.1,
    scarcityChase: 1.22,
    replacementPatience: 0.95,
    anchorAggression: 1.52,
    depthAggression: 0.9,
  },
  {
    rbCoreBudget: {
      hardBudget: 165,
      minimumFutureCorePrice: 22,
    },
    rbSlotMaxBids: [72, 68, 56, 8, 4],
    rbDemandMultiplier: 1.24,
    priceAggression: 1.06,
    scarcityChase: 1.18,
    replacementPatience: 0.97,
    anchorAggression: 1.34,
    depthAggression: 0.93,
  },
  {
    rbCoreBudget: {
      hardBudget: 148,
      minimumFutureCorePrice: 12,
    },
    rbSlotMaxBids: [78, 78, 78, 8, 4],
    rbDemandMultiplier: 1.32,
    priceAggression: 1.09,
    scarcityChase: 1.2,
    replacementPatience: 0.95,
    anchorAggression: 1.5,
    depthAggression: 0.89,
  },
  {
    rbCoreBudget: {
      hardBudget: 160,
      minimumFutureCorePrice: 18,
    },
    rbSlotMaxBids: [74, 74, 64, 8, 4],
    rbDemandMultiplier: 1.22,
    priceAggression: 1.05,
    scarcityChase: 1.16,
    replacementPatience: 0.97,
    anchorAggression: 1.3,
    depthAggression: 0.94,
  },
];

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const threeRbAuctionVariantFor = (
  variantSeed: string | undefined,
): ThreeRbAuctionVariant => {
  if (variantSeed === undefined) return defaultVariant;
  const index = Math.floor(
    (hashString(variantSeed) / hashDivisor) * threeRbAuctionVariants.length,
  );
  return threeRbAuctionVariants[index] ?? defaultVariant;
};
