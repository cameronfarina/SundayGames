import type { GenericAuctionMockPlayer } from "../types.js";

export const projectedWeeklyProductionFor = (player: GenericAuctionMockPlayer): number =>
  player.week1Projection
  ?? (player.weeks1To4Projection === undefined ? undefined : player.weeks1To4Projection / 4)
  ?? (player.seasonProjection === undefined ? 0 : player.seasonProjection / 17);

export const projectedSeasonProductionFor = (player: GenericAuctionMockPlayer): number =>
  player.seasonProjection
  ?? (player.weeks1To4Projection === undefined ? undefined : player.weeks1To4Projection * 4.25)
  ?? (player.week1Projection === undefined ? 0 : player.week1Projection * 17);

export const isStarterEligible = (player: GenericAuctionMockPlayer): boolean =>
  player.starterEligible ?? (player.projectedStarter === true);
