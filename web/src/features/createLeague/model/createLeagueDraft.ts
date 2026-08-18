import type {
  DraftType,
  EspnSettingsReview,
  LeagueDraft,
  RosterSlot,
  ScoringField,
  WizardStep,
} from "./createLeagueTypes";

export type LeagueDraftAction =
  | { readonly type: "set-league-name"; readonly value: string }
  | { readonly type: "set-season"; readonly value: number }
  | { readonly type: "set-team-count"; readonly value: number }
  | { readonly type: "set-draft-type"; readonly value: DraftType }
  | { readonly type: "set-auction-budget"; readonly value: number }
  | { readonly type: "set-minimum-bid"; readonly value: number }
  | { readonly type: "set-snake-rounds"; readonly value: number }
  | { readonly type: "set-reference-source"; readonly value: string }
  | { readonly type: "choose-manual" }
  | { readonly type: "accept-import"; readonly review: EspnSettingsReview }
  | { readonly type: "set-scoring"; readonly field: ScoringField; readonly value: number }
  | { readonly type: "set-roster"; readonly slot: RosterSlot; readonly value: number }
  | { readonly type: "set-team-field"; readonly index: number; readonly field: "displayName" | "managerNames" | "abbreviation"; readonly value: string }
  | { readonly type: "go-to-step"; readonly step: WizardStep };

const blankTeam = (index: number) => ({
  externalTeamId: String(index + 1), displayName: "", managerNames: "", abbreviation: "",
});

const resizedTeams = (draft: LeagueDraft, count: number) => {
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return Array.from({ length: safeCount }, (_, index) => draft.teams[index] ?? blankTeam(index));
};

export const createInitialLeagueDraft = (seasonYear: number): LeagueDraft => ({
  step: "basics",
  leagueName: "",
  seasonYear,
  teamCount: 12,
  draftType: "auction",
  auctionBudget: 200,
  minimumBid: 1,
  snakeRounds: 16,
  referenceSource: "",
  referenceMode: "undecided",
  externalLeagueId: "",
  scoring: {
    passingYards: 0.04, passingTouchdown: 4, rushingYards: 0.1,
    rushingTouchdown: 6, receivingYards: 0.1, receivingTouchdown: 6, reception: 0.5,
  },
  roster: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, DST: 1, K: 1, BENCH: 7 },
  teams: Array.from({ length: 12 }, (_, index) => blankTeam(index)),
});

const rosterFromReview = (review: EspnSettingsReview) => ({
  QB: review.rosterSlots["QB"] ?? 0,
  RB: review.rosterSlots["RB"] ?? 0,
  WR: review.rosterSlots["WR"] ?? 0,
  TE: review.rosterSlots["TE"] ?? 0,
  FLEX: review.rosterSlots["FLEX"] ?? 0,
  DST: review.rosterSlots["DST"] ?? 0,
  K: review.rosterSlots["K"] ?? 0,
  BENCH: review.rosterSlots["BENCH"] ?? 0,
});

const acceptedImport = (draft: LeagueDraft, review: EspnSettingsReview): LeagueDraft => ({
  ...draft,
  leagueName: review.leagueName ?? draft.leagueName,
  seasonYear: review.season,
  teamCount: review.teamCount,
  draftType: review.draft.type,
  auctionBudget: review.draft.type === "auction" ? review.draft.budgetDollars : draft.auctionBudget,
  minimumBid: review.draft.type === "auction" ? review.draft.minimumBidDollars : draft.minimumBid,
  snakeRounds: review.draft.type === "snake" ? review.draft.rounds : draft.snakeRounds,
  referenceMode: "imported",
  externalLeagueId: review.externalLeagueId,
  scoring: {
    passingYards: review.scoring.pointsPerPassingYard,
    passingTouchdown: review.scoring.pointsPerPassingTouchdown,
    rushingYards: review.scoring.pointsPerRushingYard,
    rushingTouchdown: review.scoring.pointsPerRushingTouchdown,
    receivingYards: review.scoring.pointsPerReceivingYard,
    receivingTouchdown: review.scoring.pointsPerReceivingTouchdown,
    reception: review.scoring.pointsPerReception,
  },
  roster: rosterFromReview(review),
  teams: review.teams.map(team => ({
    externalTeamId: team.externalTeamId,
    displayName: team.displayName,
    managerNames: "",
    abbreviation: team.abbreviation ?? "",
  })),
});

export const leagueDraftReducer = (draft: LeagueDraft, action: LeagueDraftAction): LeagueDraft => {
  if (action.type === "set-league-name") return { ...draft, leagueName: action.value };
  if (action.type === "set-season") return { ...draft, seasonYear: action.value };
  if (action.type === "set-team-count") return { ...draft, teamCount: action.value, teams: resizedTeams(draft, action.value) };
  if (action.type === "set-draft-type") return { ...draft, draftType: action.value };
  if (action.type === "set-auction-budget") return { ...draft, auctionBudget: action.value };
  if (action.type === "set-minimum-bid") return { ...draft, minimumBid: action.value };
  if (action.type === "set-snake-rounds") return { ...draft, snakeRounds: action.value };
  if (action.type === "set-reference-source") return { ...draft, referenceSource: action.value };
  if (action.type === "choose-manual") return { ...draft, referenceMode: "manual", externalLeagueId: "" };
  if (action.type === "accept-import") return acceptedImport(draft, action.review);
  if (action.type === "set-scoring") return { ...draft, scoring: { ...draft.scoring, [action.field]: action.value } };
  if (action.type === "set-roster") return { ...draft, roster: { ...draft.roster, [action.slot]: action.value } };
  if (action.type === "set-team-field") return {
    ...draft,
    teams: draft.teams.map((team, index) => index === action.index ? { ...team, [action.field]: action.value } : team),
  };
  return { ...draft, step: action.step };
};
