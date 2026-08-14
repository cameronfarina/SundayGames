import type { EspnSettingsReview } from "../model/createLeagueTypes";

interface ImportedReviewFixture {
  readonly kind: "review";
  readonly provider: "espn";
  readonly confirmationRequired: true;
  readonly review: EspnSettingsReview;
  readonly warnings: readonly { readonly code: string; readonly message: string }[];
}

export const importedReviewFixture: ImportedReviewFixture = {
  kind: "review",
  provider: "espn",
  confirmationRequired: true,
  review: {
    externalLeagueId: "214674",
    season: 2026,
    leagueName: "The League",
    teamCount: 2,
    draft: { type: "auction", budgetDollars: 200, minimumBidDollars: 1 },
    scoring: {
      pointsPerPassingYard: 0.04,
      pointsPerPassingTouchdown: 4,
      pointsPerRushingYard: 0.1,
      pointsPerRushingTouchdown: 6,
      pointsPerReceivingYard: 0.1,
      pointsPerReceivingTouchdown: 6,
      pointsPerReception: 0.5,
    },
    rosterSlots: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, DST: 1, K: 1, BENCH: 7 },
    teams: [
      {
        externalTeamId: "1",
        displayName: "Short King",
        abbreviation: "CAM",
        draftOrderPosition: 1,
      },
      {
        externalTeamId: "2",
        displayName: "Dart Vader",
        abbreviation: "BEAT",
        draftOrderPosition: 2,
      },
    ],
  },
  warnings: [{
    code: "minimum_bid_defaulted",
    message: "ESPN did not provide a minimum bid, so the review uses ESPN's $1 minimum.",
  }],
};
