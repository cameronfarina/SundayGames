import type { WholeDollarAllocation } from "./contracts.js";

export const allocateWholeDollars = (
  weights: readonly number[],
  dollars: number,
  maximumPerPlayer: number,
): WholeDollarAllocation => {
  const allocations = weights.map(() => 0);
  let remainingDollars = dollars;
  let activeIndexes = weights.map((_, index) => index);
  while (remainingDollars > 0 && activeIndexes.length > 0) {
    const weightTotal = activeIndexes.reduce(
      (total, index) => total + (weights[index] ?? 0),
      0,
    );
    const denominator = weightTotal > 0 ? weightTotal : activeIndexes.length;
    const quotas = activeIndexes.map(index => ({
      index,
      quota: remainingDollars * (weightTotal > 0 ? (weights[index] ?? 0) : 1) /
        denominator,
    }));
    const capped = quotas.filter(({ index, quota }) =>
      quota >= maximumPerPlayer - (allocations[index] ?? 0));
    if (capped.length > 0) {
      const cappedIndexes = new Set(capped.map(({ index }) => index));
      for (const { index } of capped) {
        const capacity = maximumPerPlayer - (allocations[index] ?? 0);
        allocations[index] = maximumPerPlayer;
        remainingDollars -= capacity;
      }
      activeIndexes = activeIndexes.filter(index => !cappedIndexes.has(index));
      continue;
    }
    let allocatedThisPass = 0;
    for (const { index, quota } of quotas) {
      const wholeDollars = Math.floor(quota);
      allocations[index] = (allocations[index] ?? 0) + wholeDollars;
      allocatedThisPass += wholeDollars;
    }
    remainingDollars -= allocatedThisPass;
    const remainderOrder = quotas.map(({ index, quota }) => ({
      index,
      remainder: quota - Math.floor(quota),
    })).sort((left, right) =>
      right.remainder - left.remainder || left.index - right.index);
    for (const { index } of remainderOrder) {
      if (remainingDollars <= 0) break;
      if ((allocations[index] ?? 0) >= maximumPerPlayer) continue;
      allocations[index] = (allocations[index] ?? 0) + 1;
      remainingDollars -= 1;
    }
  }
  return { allocations, unallocatedDollars: remainingDollars };
};
