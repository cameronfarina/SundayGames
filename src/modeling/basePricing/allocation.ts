import type { AllocationCandidate, BasePrice } from "./contracts.js";
import { clamp } from "./math.js";

interface FractionalEntry {
  candidate: AllocationCandidate;
  fractionalPrice: number;
}

interface PricedEntry extends FractionalEntry {
  price: number;
}

const positionLabel = (candidates: readonly AllocationCandidate[]): string =>
  candidates[0]?.position ?? "position";

const adjustableEntries = (
  entries: readonly FractionalEntry[],
  increasing: boolean,
): FractionalEntry[] => entries.filter(entry => increasing
  ? entry.fractionalPrice < entry.candidate.allocationCeiling
  : entry.fractionalPrice > entry.candidate.minimumPrice);

const adjustFractionalPrices = (
  entries: FractionalEntry[],
  targetTotal: number,
): void => {
  let adjustment = targetTotal - entries.reduce(
    (total, entry) => total + entry.fractionalPrice,
    0,
  );
  while (Math.abs(adjustment) > 0.000001) {
    const increasing = adjustment > 0;
    const openEntries = adjustableEntries(entries, increasing);
    if (openEntries.length === 0) break;
    const weightTotal = openEntries.reduce(
      (total, entry) => total + entry.candidate.allocationWeight,
      0,
    );
    let adjustedThisRound = 0;
    for (const entry of openEntries) {
      const share = Math.abs(adjustment) *
        (entry.candidate.allocationWeight / weightTotal);
      const capacity = increasing
        ? entry.candidate.allocationCeiling - entry.fractionalPrice
        : entry.fractionalPrice - entry.candidate.minimumPrice;
      const amount = Math.min(share, capacity);
      entry.fractionalPrice += increasing ? amount : -amount;
      adjustedThisRound += amount;
    }
    if (adjustedThisRound === 0) break;
    adjustment += increasing ? -adjustedThisRound : adjustedThisRound;
  }
};

const roundPrices = (
  entries: readonly FractionalEntry[],
  targetTotal: number,
): PricedEntry[] => {
  const priced = entries.map(entry => ({ ...entry, price: Math.floor(entry.fractionalPrice) }));
  const remainder = targetTotal - priced.reduce((total, entry) => total + entry.price, 0);
  const recipients = priced
    .filter(entry => entry.price < entry.candidate.allocationCeiling)
    .sort((left, right) =>
      Number(right.price > 1) - Number(left.price > 1) ||
      (right.fractionalPrice - Math.floor(right.fractionalPrice)) -
        (left.fractionalPrice - Math.floor(left.fractionalPrice)) ||
      right.candidate.rawPrice - left.candidate.rawPrice);
  if (recipients.length < remainder) {
    throw new Error("Unable to round prices to the requested spend target.");
  }
  for (const recipient of recipients.slice(0, remainder)) recipient.price += 1;
  return priced;
};

const basePriceFor = (entry: PricedEntry): BasePrice => {
  const {
    allocationWeight: _allocationWeight,
    allocationCeiling: _allocationCeiling,
    ...basePrice
  } = entry.candidate;
  return { ...basePrice, price: entry.price };
};

export const allocateIntegerPrices = (
  candidates: readonly AllocationCandidate[],
  targetTotal: number,
): BasePrice[] => {
  const minimumTotal = candidates.reduce(
    (total, candidate) => total + candidate.minimumPrice,
    0,
  );
  const maximumTotal = candidates.reduce(
    (total, candidate) => total + candidate.allocationCeiling,
    0,
  );
  if (minimumTotal > targetTotal) {
    throw new Error(`Minimum prices exceed ${positionLabel(candidates)} spend target.`);
  }
  if (maximumTotal < targetTotal) {
    throw new Error(`Hard ceilings cannot satisfy ${positionLabel(candidates)} spend target.`);
  }
  const entries = candidates.map(candidate => ({
    candidate,
    fractionalPrice: clamp(
      candidate.rawPrice,
      candidate.minimumPrice,
      candidate.allocationCeiling,
    ),
  }));
  adjustFractionalPrices(entries, targetTotal);
  return roundPrices(entries, targetTotal).map(basePriceFor);
};
