import type { Owner } from "../../../config/league.js";
import { OwnerAuctionBehavior } from "./configContracts.js";
import { clamp } from "./coreMath.js";
import { defaultOwnerAuctionBehavior } from "./demand.js";
import { deterministicTieBreak } from "./deterministic.js";

export interface OwnerRunVarianceConfig {
  demandPriorWeight: number;
  demandJitter: number;
  specialTeamsDemandJitter: number;
  behaviorPriorWeight: number;
  priceAggressionJitter: number;
  scarcityChaseJitter: number;
  replacementPatienceJitter: number;
  anchorAggressionJitter: number;
  depthAggressionJitter: number;
}

export const defaultOwnerRunVarianceConfig: OwnerRunVarianceConfig = {
  demandPriorWeight: 0.35,
  demandJitter: 0.16,
  specialTeamsDemandJitter: 0.04,
  behaviorPriorWeight: 0.4,
  priceAggressionJitter: 0.07,
  scarcityChaseJitter: 0.12,
  replacementPatienceJitter: 0.07,
  anchorAggressionJitter: 0.13,
  depthAggressionJitter: 0.14,
};

export const ownerRunVarianceConfigFor = (
  config: Partial<OwnerRunVarianceConfig> = {},
): OwnerRunVarianceConfig => ({
  ...defaultOwnerRunVarianceConfig,
  ...config,
});

export const centeredVarianceRoll = (
  seed: string,
  owner: Owner,
  key: string,
): number =>
  deterministicTieBreak(`${seed}:owner-run-variance`, owner, key) * 2 - 1;

export const blendMultiplierToNeutral = (value: number, priorWeight: number): number =>
  1 + (value - 1) * clamp(priorWeight, 0, 1);

export const jitterMultiplier = (
  seed: string,
  owner: Owner,
  key: string,
  amount: number,
): number =>
  1 + centeredVarianceRoll(seed, owner, key) * amount;

export const runBuildStyleMultipliersFor = (
  seed: string,
  owner: Owner,
): Required<OwnerAuctionBehavior> => {
  const roll = deterministicTieBreak(`${seed}:owner-build-style`, owner, "style");

  if (roll < 0.2) {
    return {
      priceAggression: 1.04,
      scarcityChase: 1.08,
      replacementPatience: 0.97,
      anchorAggression: 1.12,
      depthAggression: 0.9,
    };
  }
  if (roll < 0.4) {
    return {
      priceAggression: 0.97,
      scarcityChase: 0.94,
      replacementPatience: 1.05,
      anchorAggression: 0.9,
      depthAggression: 1.14,
    };
  }
  if (roll < 0.58) {
    return {
      priceAggression: 1.02,
      scarcityChase: 1.1,
      replacementPatience: 1,
      anchorAggression: 0.98,
      depthAggression: 1.04,
    };
  }
  if (roll < 0.74) {
    return {
      priceAggression: 0.99,
      scarcityChase: 0.98,
      replacementPatience: 1.03,
      anchorAggression: 0.96,
      depthAggression: 1.08,
    };
  }

  return defaultOwnerAuctionBehavior;
};
