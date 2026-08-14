export interface EspnLeagueSettingsHttpRequest {
  method: "GET";
  url: string;
}

export interface EspnLeagueSettingsHttpResponse {
  code: number;
  body: unknown;
}

export type EspnLeagueSettingsHttpTransport = (
  request: EspnLeagueSettingsHttpRequest,
) => Promise<EspnLeagueSettingsHttpResponse>;

export interface EspnLeagueSettingsImportInput {
  leagueIdOrUrl: number | string;
  season: number;
}

export interface EspnLeagueSettingsImportWarning {
  code: "minimum_bid_defaulted" | "rounds_derived_from_roster";
  message: string;
}

export interface EspnLeagueSettingsReviewTeam {
  externalTeamId: string;
  displayName: string;
  abbreviation: string | null;
  draftOrderPosition: number | null;
}

export interface EspnAuctionDraftSettingsReview {
  type: "auction";
  budgetDollars: number;
  minimumBidDollars: number;
}

export interface EspnSnakeDraftSettingsReview {
  type: "snake";
  rounds: number;
  order: readonly string[];
}

export type EspnDraftSettingsReview =
  | EspnAuctionDraftSettingsReview
  | EspnSnakeDraftSettingsReview;

export interface EspnScoringSettingsReview {
  pointsPerPassingYard: number;
  pointsPerPassingTouchdown: number;
  pointsPerRushingYard: number;
  pointsPerRushingTouchdown: number;
  pointsPerReceivingYard: number;
  pointsPerReceivingTouchdown: number;
  pointsPerReception: number;
}

export interface EspnLeagueSettingsReview {
  externalLeagueId: string;
  season: number;
  leagueName: string | null;
  teamCount: number;
  draft: EspnDraftSettingsReview;
  scoring: EspnScoringSettingsReview;
  rosterSlots: Readonly<Record<string, number>>;
  teams: readonly EspnLeagueSettingsReviewTeam[];
}

export interface EspnLeagueSettingsReviewOutcome {
  kind: "review";
  provider: "espn";
  confirmationRequired: true;
  review: EspnLeagueSettingsReview;
  warnings: readonly EspnLeagueSettingsImportWarning[];
}

export interface EspnLeagueSettingsManualReviewOutcome {
  kind: "manual-review-required";
  provider: "espn";
  confirmationRequired: true;
  reason: "private_or_unauthorized" | "settings_need_review";
  externalLeagueId: string;
  season: number;
  confirmationMethods: readonly ["screenshot", "manual"];
  message: string;
}

export type EspnLeagueSettingsImportOutcome =
  | EspnLeagueSettingsReviewOutcome
  | EspnLeagueSettingsManualReviewOutcome;
