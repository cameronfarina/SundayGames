import { deterministicFraction } from "../deterministic.js";
import {
  backupQuarterbackTeamShare,
  flatPricedAuctionPositions,
} from "../pricingConstants.js";
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
  dedicatedStarterSlotCountFor,
  hasAcquirableRbOrWrAlternative,
  hasOpenDedicatedStarterSlotFor,
  hasStarterEligibilitySignalFor,
  openDedicatedStarterDemandFor,
  remainingStarterEligiblePlayersFor,
} from "./starterPool.js";

// Hash twice: single-round FNV barely mixes a trailing team number, and a
// biased coin would give every team the same backup-quarterback habit.
const wantsBackupQuarterback = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
): boolean => deterministicFraction(
  `backup-qb:${deterministicFraction(`${state.session.seed}:${team.id}`)}`,
) < backupQuarterbackTeamShare;

export const isAutomatedAuctionAcquisitionEligible = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
): boolean => {
  const assignedSlot = assignableSlotFor(team, player);
  if (assignedSlot === undefined) return false;
  // Nobody backs up a kicker or a defense: one each, then the bench belongs
  // to runners and receivers.
  if (
    flatPricedAuctionPositions.has(player.position)
    && !hasOpenDedicatedStarterSlotFor(team, player.position)
    && hasAcquirableRbOrWrAlternative(state, team)
  ) return false;
  if (!hasStarterEligibilitySignalFor(state, player.position)) return true;
  // One cheap backup specialist is fine; a second backup wastes a bench slot
  // that a runner or receiver should take, and history says only about half
  // the room bothers with a backup quarterback at all.
  if (
    benchOnlySpecialistPositions.has(player.position)
    && !hasOpenDedicatedStarterSlotFor(team, player.position)
    && hasAcquirableRbOrWrAlternative(state, team)
  ) {
    if (
      (team.positionCounts[player.position] ?? 0)
        > dedicatedStarterSlotCountFor(team, player.position)
    ) return false;
    if (player.position === "QB" && !wantsBackupQuarterback(state, team)) return false;
  }

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
