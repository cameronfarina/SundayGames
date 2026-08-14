import type {
  AllocationCandidate,
  PriceCandidate,
  PricingConfig,
} from "./contracts.js";

const compareStrength = (left: PriceCandidate, right: PriceCandidate): number =>
  right.rawPrice - left.rawPrice ||
  right.weeks1To4 - left.weeks1To4 ||
  left.name.localeCompare(right.name);

const topPriceVolumeCaps = (
  candidates: readonly PriceCandidate[],
  config: PricingConfig,
): Map<string, number> => {
  const caps = new Map(
    candidates.map(candidate => [candidate.normalizedName, candidate.hardCeiling]),
  );
  const limits = [...config.topPriceVolumeLimits]
    .sort((left, right) => right.threshold - left.threshold);
  const rankedCandidates = [...candidates].sort(compareStrength);
  for (const limit of limits) {
    const allowedNames = new Set(
      rankedCandidates.slice(0, limit.maxCount)
        .map(candidate => candidate.normalizedName),
    );
    for (const candidate of rankedCandidates) {
      if (allowedNames.has(candidate.normalizedName)) continue;
      const currentCap = caps.get(candidate.normalizedName) ?? candidate.hardCeiling;
      caps.set(candidate.normalizedName, Math.min(currentCap, limit.threshold - 1));
    }
  }
  return caps;
};

export const applyTopPriceVolumeCaps = (
  candidates: readonly PriceCandidate[],
  config: PricingConfig,
): AllocationCandidate[] => {
  const caps = topPriceVolumeCaps(candidates, config);
  return candidates.map(candidate => {
    const allocationCeiling = caps.get(candidate.normalizedName) ?? candidate.hardCeiling;
    return {
      ...candidate,
      minimumPrice: Math.min(candidate.minimumPrice, allocationCeiling),
      allocationCeiling,
    };
  });
};
