import type { Position } from "../../../config/league.js";
import { optimizeLineup, playerMetricValue } from "../../lineupOptimizer.js";
import type { LineupEntry, Player, StarterSlot } from "../../types.js";
import type { MockRosterSummary } from "../mockBatch.js";
import { roundToTwo } from "./formatting.js";
import type { MockResultsPlayer, MockResultsPlayerSlot } from "./teamContracts.js";

const starterSlotOrder: Record<StarterSlot, number> = {
  QB: 1,
  RB1: 2,
  RB2: 3,
  WR1: 4,
  WR2: 5,
  TE: 6,
  FLEX: 7,
  K: 8,
  DST: 9,
};

const positionOrder: Record<Position, number> = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 4,
  K: 5,
  DST: 6,
};

const playerResultFor = (
  player: Player,
  slot: MockResultsPlayerSlot,
  starter: boolean,
): MockResultsPlayer => ({
  name: player.name,
  position: player.position,
  slot,
  price: player.price,
  week1: roundToTwo(player.week1),
  weeks1To4: roundToTwo(player.weeks1To4),
  seasonProjection: roundToTwo(playerMetricValue(player, "seasonProjection")),
  starter,
});

export const optimizedWeekOneLineup = (roster: MockRosterSummary): LineupEntry[] =>
  optimizeLineup({ strategy: "mock-results", players: roster.players }, "week1")
    .sort((left, right) => starterSlotOrder[left.slot] - starterSlotOrder[right.slot]);

export const seasonLineupFor = (roster: MockRosterSummary): LineupEntry[] =>
  optimizeLineup({ strategy: "mock-results-season", players: roster.players }, "seasonProjection");

export const benchPlayersFor = (
  roster: MockRosterSummary,
  starters: readonly LineupEntry[],
): MockResultsPlayer[] => {
  const starterNames = new Set(starters.map(entry => entry.player.name));
  return roster.players
    .filter(player => !starterNames.has(player.name))
    .sort(
      (left, right) =>
        positionOrder[left.position] - positionOrder[right.position] ||
        right.week1 - left.week1 ||
        right.price - left.price ||
        left.name.localeCompare(right.name),
    )
    .map(player => playerResultFor(player, "BENCH", false));
};

export const starterResultFor = (entry: LineupEntry): MockResultsPlayer =>
  playerResultFor(entry.player, entry.slot, true);
