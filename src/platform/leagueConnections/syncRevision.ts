export const syncRevisionIsAfter = (candidate: string, baseline: string): boolean =>
  BigInt(candidate) > BigInt(baseline);
