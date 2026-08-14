import { assignableSlotFor, canAcquire } from "../roster.js";
import type {
  GenericAuctionMockPlayer,
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "../types.js";
import { isStarterEligible } from "./playerProduction.js";
import {
  benchOnlySpecialistPositions,
  bestPositiveStarterFallbackFor,
  hasOpenDedicatedStarterSlotFor,
  hasProjectedRbOrWrAlternative,
  hasStarterEligibilitySignalFor,
  openDedicatedStarterDemandFor,
  remainingStarterEligiblePlayersFor,
} from "./starterPool.js";

export const isAutomatedAuctionAcquisitionEligible = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
): boolean => {
  const assignedSlot = assignableSlotFor(team, player);
  if (assignedSlot === undefined) return false;
  if (!hasStarterEligibilitySignalFor(state, player.position)) return true;
  if (
    benchOnlySpecialistPositions.has(player.position)
    && !hasOpenDedicatedStarterSlotFor(team, player.position)
    && hasProjectedRbOrWrAlternative(state, team)
  ) return false;

  const starterEligiblePlayers = remainingStarterEligiblePlayersFor(state, player.position);

  if (hasOpenDedicatedStarterSlotFor(team, player.position)) {
    if (starterEligiblePlayers.some(candidate =>
      canAcquire(state, team, candidate, state.configuration.minimumBidDollars)
    )) return isStarterEligible(player);

    return bestPositiveStarterFallbackFor(state, team, player.position)?.id === player.id;
  }
  if (!isStarterEligible(player)) return true;

  return starterEligiblePlayers.length > openDedicatedStarterDemandFor(state, player.position);
};
