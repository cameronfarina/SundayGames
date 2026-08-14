import type {
  SanityFlagKey,
  TopPlayerSanityRow,
} from "./contracts.js";

export const flagCountsFor = (
  rows: readonly TopPlayerSanityRow[],
): Partial<Record<SanityFlagKey, number>> => {
  const counts: Partial<Record<SanityFlagKey, number>> = {};
  for (const row of rows) {
    for (const flag of row.flags) counts[flag.key] = (counts[flag.key] ?? 0) + 1;
  }
  return counts;
};
