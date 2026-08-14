import type { Position } from "../../../../config/league.js";
import type { LineupEntry, Player } from "../../../types.js";
import type { MockRosterSummary } from "../../mockBatch.js";
import type { DraftPlanStrategyDefinition } from "../contracts.js";
import { sortPlayers } from "../players.js";
import { threeRbPathRules } from "../threeRbPathRules.js";

const qualifiesForThreeRb = (
  rbCore: readonly Player[],
  strategy: DraftPlanStrategyDefinition,
  lineup: readonly LineupEntry[],
): boolean => {
  const [rb1, rb2, rb3] = rbCore;
  if (!rb1 || !rb2 || !rb3) return false;
  const startingRbCount = lineup.filter(entry => entry.player.position === "RB").length;
  return rb1.price >= strategy.thresholds.rb1Minimum &&
    rb2.price >= strategy.thresholds.rb2Minimum &&
    rb3.price >= strategy.thresholds.rb3Minimum &&
    rbCore.reduce((total, player) => total + player.price, 0) >=
      strategy.thresholds.rbCoreSpendMinimum &&
    startingRbCount >= threeRbPathRules.rbCoreBudget.targetCount;
};

const draftedSpendFor = (
  players: readonly Player[],
  position: Position,
  count: number,
): number =>
  sortPlayers(players.filter(player => player.position === position))
    .slice(0, count)
    .reduce((total, player) => total + player.price, 0);

export const qualifiesForStrategy = (
  roster: MockRosterSummary,
  rbCore: readonly Player[],
  strategy: DraftPlanStrategyDefinition,
  lineup: readonly LineupEntry[],
): boolean => {
  if (strategy.key === "three-rb") return qualifiesForThreeRb(rbCore, strategy, lineup);
  if (lineup.length < 9) return false;
  if (strategy.key === "hero-rb") {
    return (rbCore[0]?.price ?? 0) >= strategy.thresholds.rb1Minimum &&
      draftedSpendFor(roster.players, "WR", 2) >= 30;
  }
  if (strategy.key === "wr-heavy") {
    return draftedSpendFor(roster.players, "WR", 2) >= 40 &&
      (rbCore[0]?.price ?? 0) >= strategy.thresholds.rb1Minimum;
  }
  return (rbCore[0]?.price ?? 0) >= strategy.thresholds.rb1Minimum &&
    draftedSpendFor(roster.players, "WR", 2) >= 12;
};
