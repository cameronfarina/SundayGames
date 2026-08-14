import type {
  AuctionSettings,
  FantasyTeam,
  LeagueSeasonReadinessCheck,
  SnakeSettings,
} from "./contracts.js";

export const validateAuctionBudget = (
  settings: AuctionSettings,
  rosterSize?: number,
): LeagueSeasonReadinessCheck => {
  const validBudget = Number.isFinite(settings.budgetDollars) && settings.budgetDollars > 0;
  const validMinimum = Number.isFinite(settings.minimumBidDollars)
    && settings.minimumBidDollars > 0 && settings.minimumBidDollars <= settings.budgetDollars;
  const wholeDollars = Number.isInteger(settings.budgetDollars)
    && Number.isInteger(settings.minimumBidDollars);
  const reserve = rosterSize === undefined || !Number.isInteger(rosterSize) || rosterSize <= 0
    || settings.budgetDollars >= rosterSize * settings.minimumBidDollars;
  let message = `Auction budget is $${settings.budgetDollars}.`;
  if (!validBudget) message = "Auction budget must be greater than $0.";
  else if (!validMinimum) message = "Auction minimum bid must be greater than $0 and no more than the budget.";
  else if (!wholeDollars) message = "Auction budget and minimum bid must be positive whole-dollar amounts.";
  else if (!reserve && rosterSize !== undefined) {
    message = `Auction budget must reserve the $${settings.minimumBidDollars} minimum bid for all ${rosterSize} roster slots.`;
  }
  return {
    key: "auction-budget", label: "Auction budget",
    status: validBudget && validMinimum && wholeDollars && reserve ? "pass" : "fail",
    severity: "blocker", message,
  };
};

export const validateSnakeDraft = (
  settings: SnakeSettings,
  teams: readonly FantasyTeam[],
  rosterSize?: number,
): LeagueSeasonReadinessCheck => {
  const teamIds = new Set(settings.order);
  const validRounds = Number.isInteger(settings.rounds) && settings.rounds > 0;
  const everyTeam = settings.order.length === teams.length && teamIds.size === teams.length
    && teams.every(team => teamIds.has(team.id));
  const fitsRoster = rosterSize === undefined || settings.rounds <= rosterSize;
  let message = `${settings.rounds} snake draft rounds and team order are configured.`;
  if (!validRounds || !everyTeam) {
    message = "Snake drafts must have at least one round and include every team exactly once in draft order.";
  } else if (!fitsRoster && rosterSize !== undefined) {
    message = `Snake draft rounds cannot exceed the ${rosterSize}-player roster capacity.`;
  }
  return {
    key: "snake-draft", label: "Snake draft",
    status: validRounds && everyTeam && fitsRoster ? "pass" : "fail",
    severity: "blocker", message,
  };
};
