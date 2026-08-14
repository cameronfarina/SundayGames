import { espnMinimumBidDollars } from "./constants.js";
import {
  normalizedString,
  optionalPositiveInteger,
  requiredNumber,
  type JsonObject,
} from "./json.js";
import type {
  EspnDraftSettingsReview,
  EspnLeagueSettingsImportWarning,
} from "./types.js";

interface DraftReview {
  draft: EspnDraftSettingsReview;
  warnings: EspnLeagueSettingsImportWarning[];
}

const auctionDraftFor = (settings: JsonObject): DraftReview => {
  const minimumBid = optionalPositiveInteger(
    settings.minimumBid,
    "settings.draftSettings.minimumBid",
  );
  return {
    draft: {
      type: "auction",
      budgetDollars: requiredNumber(settings.auctionBudget, "settings.draftSettings.auctionBudget"),
      minimumBidDollars: minimumBid ?? espnMinimumBidDollars,
    },
    warnings: minimumBid === null
      ? [{
          code: "minimum_bid_defaulted",
          message: "ESPN did not provide a minimum bid, so the review uses ESPN's $1 minimum.",
        }]
      : [],
  };
};

const snakeDraftFor = (
  settings: JsonObject,
  pickOrder: readonly string[],
  rosterSlotCount: number,
): DraftReview => {
  const rounds = optionalPositiveInteger(settings.rounds, "settings.draftSettings.rounds");
  return {
    draft: { type: "snake", rounds: rounds ?? rosterSlotCount, order: [...pickOrder] },
    warnings: rounds === null
      ? [{
          code: "rounds_derived_from_roster",
          message: `ESPN did not provide snake rounds, so the review uses the ${rosterSlotCount} imported roster slots.`,
        }]
      : [],
  };
};

export const draftFor = (
  settings: JsonObject,
  pickOrder: readonly string[],
  rosterSlotCount: number,
): DraftReview => {
  const draftType = normalizedString(settings.type)?.toUpperCase();
  if (draftType === "AUCTION") return auctionDraftFor(settings);
  if (draftType === "SNAKE") return snakeDraftFor(settings, pickOrder, rosterSlotCount);
  throw new Error(`Unsupported ESPN draft type "${draftType ?? "unknown"}".`);
};
