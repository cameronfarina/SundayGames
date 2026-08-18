import { backupDepthBidCushionDollars } from "./pricingConstants.js";
import {
  benchOnlySpecialistPositions,
  hasOpenDedicatedStarterSlotFor,
} from "./starterEligibility/starterPool.js";
import type {
  GenericAuctionMockPlayer,
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "./types.js";

// A specialist backup (extra QB, TE, K, or DST) never earns starter money.
export const backupDepthMaximumBidFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
): number | undefined =>
  benchOnlySpecialistPositions.has(player.position)
  && !hasOpenDedicatedStarterSlotFor(team, player.position)
    ? state.configuration.minimumBidDollars + backupDepthBidCushionDollars
    : undefined;
