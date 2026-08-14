import type { Position } from "../../../config/league.js";
import { analyzeRosterSlots } from "../leagueCreation.js";
import type { LeagueSeason } from "../leagueSeason.js";
import type { LiveDraftRoomRosterPlayer } from "./contracts/players.js";

export const emptyPositionCounts = (): Record<Position, number> => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DST: 0,
});

export const countPositions = (
  players: readonly LiveDraftRoomRosterPlayer[],
): Record<Position, number> => {
  const counts = emptyPositionCounts();
  for (const player of players) counts[player.position] += 1;
  return counts;
};

export const draftRosterCapacityFor = (season: LeagueSeason): number =>
  analyzeRosterSlots(season.settings.roster.lineup).draftCapacity;

export const positionMaximumsFor = (season: LeagueSeason): Record<Position, number> => {
  const derived = analyzeRosterSlots(season.settings.roster.lineup).rosterMaximums;
  const maximumFor = (position: Position): number => {
    const configured = season.settings.roster.rosterMaximums[position];
    return Number.isInteger(configured) && configured >= 0
      ? Math.min(configured, derived[position])
      : derived[position];
  };

  return {
    QB: maximumFor("QB"),
    RB: maximumFor("RB"),
    WR: maximumFor("WR"),
    TE: maximumFor("TE"),
    K: maximumFor("K"),
    DST: maximumFor("DST"),
  };
};

export const maxBidFor = (
  budgetRemaining: number,
  rosterSlotsRemaining: number,
  minimumBid: number,
): number => rosterSlotsRemaining <= 0
  ? 0
  : Math.max(0, budgetRemaining - Math.max(0, rosterSlotsRemaining - 1) * minimumBid);
