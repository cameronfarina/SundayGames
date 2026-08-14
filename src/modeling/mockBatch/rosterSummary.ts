import { leagueConfig, type Owner } from "../../../config/league.js";
import type { MockRoster } from "../../types.js";
import { validateRoster } from "../../validateMocks.js";
import type { MockRosterSummary } from "./contracts.js";
import { sumPositionSpend } from "./positionAmounts.js";

export const summarizeRoster = (owner: Owner, roster: MockRoster): MockRosterSummary => {
  const validation = validateRoster(roster);
  const summary: MockRosterSummary = {
    owner,
    spend: validation.spend,
    budgetRemaining: leagueConfig.auctionBudget - validation.spend,
    valid: validation.valid,
    errors: validation.errors,
    players: roster.players,
    positionSpend: sumPositionSpend(roster),
  };

  if (validation.week1Score !== undefined) summary.week1Score = validation.week1Score;
  if (validation.weeks1To4Score !== undefined) summary.weeks1To4Score = validation.weeks1To4Score;
  return summary;
};
