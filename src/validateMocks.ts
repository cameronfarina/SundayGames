import { leagueConfig, type Position } from "../config/league.js";
import { lineupScore, optimizeLineup } from "./lineupOptimizer.js";
import type { MockRoster } from "./types.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  spend: number;
  week1Score?: number;
  weeks1To4Score?: number;
}

const rosterPositions: readonly Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

export const validateRoster = (roster: MockRoster): ValidationResult => {
  const errors: string[] = [];
  const names = roster.players.map(player => player.name);
  const spend = roster.players.reduce((sum, player) => sum + player.price, 0);

  if (roster.players.length !== leagueConfig.rosterSize) errors.push("Roster must contain 16 players.");
  if (new Set(names).size !== names.length) errors.push("Roster contains duplicate players.");
  if (spend > leagueConfig.auctionBudget) errors.push("Roster exceeds the $200 budget.");

  const counts = roster.players.reduce<Record<Position, number>>(
    (acc, player) => ({ ...acc, [player.position]: acc[player.position] + 1 }),
    { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
  );

  for (const position of rosterPositions) {
    const maximum = leagueConfig.rosterMaximums[position];
    if (counts[position] > maximum) errors.push(`${position} exceeds maximum of ${maximum}.`);
  }

  try {
    const week1 = optimizeLineup(roster, "week1");
    const weeks1To4 = optimizeLineup(roster, "weeks1To4");
    return {
      valid: errors.length === 0,
      errors,
      spend,
      week1Score: lineupScore(week1, "week1"),
      weeks1To4Score: lineupScore(weeks1To4, "weeks1To4"),
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Unknown lineup error.");
    return { valid: false, errors, spend };
  }
};
