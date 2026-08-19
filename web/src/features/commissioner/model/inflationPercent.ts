const MINIMUM_PERCENT = 1;
const MAXIMUM_PERCENT = 1000;
const PERCENT_SCALE = 100;

const PERCENT_ERROR = `Enter a whole percentage from ${String(MINIMUM_PERCENT)} to ${String(MAXIMUM_PERCENT)}.`;

/** Reads back a stored multiplier as the percentage a commissioner typed. */
export const savedInflationPercent = (multiplier: number | undefined): string =>
  multiplier === undefined ? "" : String(Math.round(multiplier * PERCENT_SCALE));

/** An empty box means no percentage is set, which is not a mistake. */
export const inflationPercentError = (value: string): string | undefined => {
  const cleaned = value.trim();
  if (cleaned.length === 0) return undefined;
  const percent = Number(cleaned);
  return Number.isInteger(percent)
    && percent >= MINIMUM_PERCENT
    && percent <= MAXIMUM_PERCENT
    ? undefined
    : PERCENT_ERROR;
};
