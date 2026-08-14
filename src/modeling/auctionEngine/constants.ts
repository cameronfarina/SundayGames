import { leagueConfig, type Position } from "../../../config/league.js";
import type { Player } from "../../types.js";
import { PositionAmounts } from "./configContracts.js";
import { ReplacementPriceTier } from "./poolContracts.js";

export const flexEligiblePositions: readonly Position[] = ["RB", "WR", "TE"];

export const premiumPositions: readonly Position[] = ["QB", "RB", "WR", "TE"];

export const defaultSeed = "mockd-default";

export const hashDivisor = 0x100000000;

export const replacementPatiencePriceThreshold = 3;

export const anchorBuildPriceThreshold = 40;

export const depthBuildPriceThreshold = 19;

export const targetAnchorRosterCount = 2;

export const onePlayerRosterCountThreshold = 1.4;

export const budgetFlushBidStartRosterSlotsRemaining = 8;

export const budgetFlushTargetEndingBudget = 4;

export const defaultReplacementPrice = 1;

export const defaultReplacementPriceLadder: readonly ReplacementPriceTier[] = [];

export const seasonProjectionForPlayer = (player: Pick<Player, "seasonProjection" | "weeks1To4">): number =>
  player.seasonProjection ?? player.weeks1To4 * 4;

export const emptyPositionAmounts = (): PositionAmounts => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DST: 0,
});

export const defaultStarterMinimums = (): PositionAmounts => ({
  QB: leagueConfig.lineup.QB,
  RB: leagueConfig.lineup.RB,
  WR: leagueConfig.lineup.WR,
  TE: leagueConfig.lineup.TE,
  K: leagueConfig.lineup.K,
  DST: leagueConfig.lineup.DST,
});

export const configuredRosterMaximums = (): PositionAmounts => ({
  QB: leagueConfig.rosterMaximums.QB,
  RB: leagueConfig.rosterMaximums.RB,
  WR: leagueConfig.rosterMaximums.WR,
  TE: leagueConfig.rosterMaximums.TE,
  K: leagueConfig.rosterMaximums.K,
  DST: leagueConfig.rosterMaximums.DST,
});
