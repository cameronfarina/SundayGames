import type {
  ConfirmedLeagueSetup,
  ConfirmedLeagueTeam,
  LeagueDraft,
  RosterSlot,
  ScoringField,
} from "./createLeagueTypes";

type FieldErrors = Readonly<Record<string, string>>;
export const scoringFields: readonly ScoringField[] = [
  "passingYards", "passingTouchdown", "rushingYards", "rushingTouchdown",
  "receivingYards", "receivingTouchdown", "reception",
];
export const rosterSlotOrder: readonly RosterSlot[] = [
  "QB", "RB", "WR", "TE", "FLEX", "DST", "K", "BENCH",
];

export const basicsErrors = (draft: LeagueDraft): FieldErrors => {
  const errors: Record<string, string> = {};
  if (draft.leagueName.trim().length === 0) errors["leagueName"] = "Enter a league name.";
  if (!Number.isSafeInteger(draft.seasonYear) || draft.seasonYear < 2020 || draft.seasonYear > 2100) {
    errors["seasonYear"] = "Enter a valid season.";
  }
  if (!Number.isSafeInteger(draft.teamCount) || draft.teamCount < 2 || draft.teamCount > 20) {
    errors["teamCount"] = "Use between 2 and 20 teams.";
  }
  if (draft.draftType === "auction" && (!Number.isFinite(draft.auctionBudget) || draft.auctionBudget <= 0)) {
    errors["auctionBudget"] = "Enter a positive auction budget.";
  }
  if (draft.draftType === "auction" && (!Number.isFinite(draft.minimumBid) || draft.minimumBid <= 0)) {
    errors["minimumBid"] = "Enter a positive minimum bid.";
  }
  if (draft.draftType === "snake"
    && (!Number.isSafeInteger(draft.snakeRounds) || draft.snakeRounds < 1 || draft.snakeRounds > 40)) {
    errors["snakeRounds"] = "Use between 1 and 40 rounds.";
  }
  return errors;
};

export const scoringErrors = (draft: LeagueDraft): FieldErrors => {
  const errors: Record<string, string> = {};
  scoringFields.forEach(field => {
    if (!Number.isFinite(draft.scoring[field])) errors[field] = "Enter a valid point value.";
  });
  return errors;
};

export const rosterErrors = (draft: LeagueDraft): FieldErrors => {
  const errors: Record<string, string> = {};
  rosterSlotOrder.forEach(slot => {
    const count = draft.roster[slot];
    if (!Number.isSafeInteger(count) || count < 0) errors[slot] = "Use a non-negative whole number.";
  });
  const total = rosterSlotOrder.reduce((sum, slot) => sum + Math.max(0, draft.roster[slot]), 0);
  if (total === 0) errors["roster"] = "Add at least one draftable roster slot.";
  return errors;
};

export const teamErrors = (draft: LeagueDraft): readonly string[] =>
  draft.teams.map(team => team.displayName.trim().length === 0 ? "Enter a team name." : "");

export const isLeagueDraftComplete = (draft: LeagueDraft): boolean =>
  Object.keys(basicsErrors(draft)).length === 0
  && draft.referenceMode !== "undecided"
  && Object.keys(scoringErrors(draft)).length === 0
  && Object.keys(rosterErrors(draft)).length === 0
  && teamErrors(draft).every(error => error.length === 0)
  && draft.teams.length === draft.teamCount;

const confirmedTeam = (team: LeagueDraft["teams"][number]): ConfirmedLeagueTeam => {
  const managerNames = team.managerNames.split(",").map(name => name.trim()).filter(Boolean);
  const abbreviation = team.abbreviation.trim();
  return {
    externalTeamId: team.externalTeamId,
    displayName: team.displayName.trim(),
    ...(managerNames.length === 0 ? {} : { managerNames }),
    ...(abbreviation.length === 0 ? {} : { abbreviation }),
  };
};

const slug = (value: string): string => value.trim().toLowerCase()
  .replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");

export const createLeagueSetup = (draft: LeagueDraft): ConfirmedLeagueSetup => {
  const teamIds = draft.teams.map(team => team.externalTeamId);
  const rounds = rosterSlotOrder.reduce((sum, slot) => sum + draft.roster[slot], 0);
  return {
    provider: draft.referenceMode === "imported" ? "espn" : "mockd",
    externalLeagueId: draft.referenceMode === "imported"
      ? draft.externalLeagueId
      : `mockd-${String(draft.seasonYear)}-${slug(draft.leagueName)}`,
    leagueName: draft.leagueName.trim(),
    seasonYear: draft.seasonYear,
    expectedTeamCount: draft.teamCount,
    teams: draft.teams.map(confirmedTeam),
    draft: draft.draftType === "auction"
      ? { type: "auction", budgetDollars: draft.auctionBudget, minimumBidDollars: draft.minimumBid }
      : { type: "snake", rounds: draft.snakeRounds || rounds, order: teamIds, reversal: "standard" },
    scoring: draft.scoring,
    rosterSlots: draft.roster,
  };
};
