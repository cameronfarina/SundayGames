import type { MockResultsPlayer, MockResultsTeam } from "./teamContracts.js";

export const topStarterFor = (team: MockResultsTeam): MockResultsPlayer | undefined =>
  [...team.starters].sort(
    (left, right) =>
      right.week1 - left.week1 ||
      right.seasonProjection - left.seasonProjection ||
      right.price - left.price ||
      left.name.localeCompare(right.name),
  )[0];

export const bestValueFor = (team: MockResultsTeam): MockResultsPlayer | undefined =>
  [...team.players].sort(
    (left, right) =>
      (right.week1 / Math.max(1, right.price)) - (left.week1 / Math.max(1, left.price)) ||
      right.week1 - left.week1 ||
      left.name.localeCompare(right.name),
  )[0];

export const corePlayersFor = (team: MockResultsTeam): MockResultsPlayer[] =>
  [...team.starters]
    .sort(
      (left, right) =>
        right.week1 - left.week1 ||
        right.seasonProjection - left.seasonProjection ||
        right.price - left.price ||
        left.name.localeCompare(right.name),
    )
    .slice(0, 3);
