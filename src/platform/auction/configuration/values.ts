import { GenericAuctionMockError } from "../errors.js";

export const isNonBlank = (value: string): boolean => value.trim().length > 0;

export const isNonNegativeFinite = (value: number): boolean => (
  Number.isFinite(value) && value >= 0
);

export const assertNonNegativeMap = (
  values: Readonly<Record<string, number>>,
  label: string,
): void => {
  for (const [key, value] of Object.entries(values)) {
    if (!isNonBlank(key) || !isNonNegativeFinite(value)) {
      throw new GenericAuctionMockError(
        "invalid_config",
        `${label} must use non-blank keys and non-negative finite values.`,
      );
    }
  }
};
