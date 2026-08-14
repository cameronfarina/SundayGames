export type WizardStep = "basics" | "reference" | "scoring" | "roster" | "teams";
export type DraftType = "auction" | "snake";
export type ReferenceMode = "undecided" | "manual" | "imported";
export type RosterSlot = "QB" | "RB" | "WR" | "TE" | "FLEX" | "DST" | "K" | "BENCH";
export type ScoringField = keyof LeagueScoring;

export interface LeagueScoring {
  readonly passingYards: number;
  readonly passingTouchdown: number;
  readonly rushingYards: number;
  readonly rushingTouchdown: number;
  readonly receivingYards: number;
  readonly receivingTouchdown: number;
  readonly reception: number;
}

export type LeagueRoster = Readonly<Record<RosterSlot, number>>;

export interface LeagueTeamDraft {
  readonly externalTeamId: string;
  readonly displayName: string;
  readonly managerNames: string;
  readonly abbreviation: string;
}

export interface LeagueDraft {
  readonly step: WizardStep;
  readonly leagueName: string;
  readonly seasonYear: number;
  readonly teamCount: number;
  readonly draftType: DraftType;
  readonly auctionBudget: number;
  readonly minimumBid: number;
  readonly snakeRounds: number;
  readonly referenceSource: string;
  readonly referenceMode: ReferenceMode;
  readonly externalLeagueId: string;
  readonly scoring: LeagueScoring;
  readonly roster: LeagueRoster;
  readonly teams: readonly LeagueTeamDraft[];
}

export interface EspnReviewTeam {
  readonly externalTeamId: string;
  readonly displayName: string;
  readonly abbreviation: string | null;
  readonly draftOrderPosition: number | null;
}

export interface EspnSettingsReview {
  readonly externalLeagueId: string;
  readonly season: number;
  readonly leagueName: string | null;
  readonly teamCount: number;
  readonly draft:
    | { readonly type: "auction"; readonly budgetDollars: number; readonly minimumBidDollars: number }
    | { readonly type: "snake"; readonly rounds: number; readonly order: readonly string[] };
  readonly scoring: {
    readonly pointsPerPassingYard: number;
    readonly pointsPerPassingTouchdown: number;
    readonly pointsPerRushingYard: number;
    readonly pointsPerRushingTouchdown: number;
    readonly pointsPerReceivingYard: number;
    readonly pointsPerReceivingTouchdown: number;
    readonly pointsPerReception: number;
  };
  readonly rosterSlots: Readonly<Record<string, number>>;
  readonly teams: readonly EspnReviewTeam[];
}

export interface ConfirmedLeagueSetup {
  readonly provider: "mockd" | "espn";
  readonly externalLeagueId: string;
  readonly leagueName: string;
  readonly seasonYear: number;
  readonly expectedTeamCount: number;
  readonly teams: readonly ConfirmedLeagueTeam[];
  readonly draft:
    | { readonly type: "auction"; readonly budgetDollars: number; readonly minimumBidDollars: number }
    | { readonly type: "snake"; readonly rounds: number; readonly order: readonly string[]; readonly reversal: "standard" };
  readonly scoring: LeagueScoring;
  readonly rosterSlots: LeagueRoster;
}

export interface ConfirmedLeagueTeam {
  readonly externalTeamId: string;
  readonly displayName: string;
  readonly managerNames?: readonly string[];
  readonly abbreviation?: string;
}
