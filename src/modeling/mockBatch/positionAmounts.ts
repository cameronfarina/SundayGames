import type { Player, MockRoster } from "../../types.js";
import type { PositionAmounts } from "./contracts.js";

export const emptyPositionAmounts = (): PositionAmounts => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DST: 0,
});

export const sumPositionSpend = (roster: MockRoster): PositionAmounts => {
  const spend = emptyPositionAmounts();
  for (const player of roster.players) spend[player.position] += player.price;
  return spend;
};

export const countRosterPositions = (roster: readonly Player[]): PositionAmounts => {
  const counts = emptyPositionAmounts();
  for (const player of roster) counts[player.position] += 1;
  return counts;
};
