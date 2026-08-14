import type { ParsedKeeperCommand } from "./internalTypes.js";
import type { KeeperCommandErrorResult, ParseKeeperCommandInput } from "./types.js";

export const validateValue = (
  input: ParseKeeperCommandInput,
  parsed: ParsedKeeperCommand,
): KeeperCommandErrorResult | undefined => {
  if (!Number.isSafeInteger(parsed.trailingValue)) {
    return {
      kind: "error",
      error: {
        code: "invalid_value",
        message: input.draftType === "snake"
          ? "Snake keeper round must be a positive whole number."
          : "Auction keeper cost must be a non-negative whole number.",
        mention: parsed.rawTrailingValue,
      },
    };
  }

  if (input.draftType === "auction") {
    const minimumBidDollars = input.auctionMinimumBidDollars ?? 1;
    if (parsed.trailingValue < minimumBidDollars) {
      return {
        kind: "error",
        error: {
          code: "invalid_value",
          message: `Auction keeper cost must be at least $${minimumBidDollars}.`,
          mention: parsed.rawTrailingValue,
        },
      };
    }
    return undefined;
  }

  if (
    parsed.trailingValue <= 0
    || (input.snakeRoundCount !== undefined && parsed.trailingValue > input.snakeRoundCount)
  ) {
    return {
      kind: "error",
      error: {
        code: "invalid_value",
        message: input.snakeRoundCount === undefined
          ? "Snake keeper round must be a positive whole number."
          : `Snake keeper round must be between 1 and ${input.snakeRoundCount}.`,
        mention: parsed.rawTrailingValue,
      },
    };
  }

  return undefined;
};
