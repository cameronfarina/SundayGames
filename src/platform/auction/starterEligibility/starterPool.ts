import { analysisCacheFor } from "../analysisCache.js";
import { canAcquire } from "../roster.js";
import type {
  GenericAuctionMockBoardPlayer,
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "../types.js";
import {
  isStarterEligible,
  projectedSeasonProductionFor,
  projectedWeeklyProductionFor,
} from "./playerProduction.js";

export const dedicatedStarterSlotCountFor = (
  team: GenericAuctionMockTeamReadModel,
  position: string,
): number => team.slots.filter(slot =>
  slot.eligiblePositions.length === 1
  && slot.eligiblePositions[0] === position
).length;

export const hasStarterEligibilitySignalFor = (
  state: GenericAuctionMockState,
  position: string,
): boolean => {
  const byPosition = analysisCacheFor(state).starterEligibilitySignalByPosition;
  const cached = byPosition.get(position);
  if (cached !== undefined) return cached;

  const configured = state.configuration.players.some(player =>
    player.position === position
    && player.starterEligible !== undefined
  );
  byPosition.set(position, configured);
  return configured;
};

export const hasOpenDedicatedStarterSlotFor = (
  team: GenericAuctionMockTeamReadModel,
  position: string,
): boolean => team.slots.some(slot =>
  slot.playerId === undefined
  && slot.eligiblePositions.length === 1
  && slot.eligiblePositions[0] === position
);

export const openDedicatedStarterDemandFor = (
  state: GenericAuctionMockState,
  position: string,
): number => state.teams.reduce((total, team) => total + team.slots.filter(slot =>
  slot.playerId === undefined
  && slot.eligiblePositions.length === 1
  && slot.eligiblePositions[0] === position
).length, 0);

export const remainingStarterEligiblePlayersFor = (
  state: GenericAuctionMockState,
  position: string,
): readonly GenericAuctionMockBoardPlayer[] => {
  const byPosition = analysisCacheFor(state).remainingStarterEligiblePlayersByPosition;
  const cached = byPosition.get(position);
  if (cached !== undefined) return cached;

  const remaining = state.board.players.filter(player =>
    player.position === position
    && isStarterEligible(player)
    && player.status !== "sold"
  );
  byPosition.set(position, remaining);
  return remaining;
};

export const benchOnlySpecialistPositions = new Set(["QB", "TE", "K", "DST"]);

export const hasAcquirableRbOrWrAlternative = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
): boolean => {
  const byTeam = analysisCacheFor(state).acquirableRbOrWrAlternativeByTeamId;
  const cached = byTeam.get(team.id);
  if (cached !== undefined) return cached;

  const hasAlternative = state.board.players.some(candidate =>
    candidate.status === "available"
    && (candidate.position === "RB" || candidate.position === "WR")
    && canAcquire(state, team, candidate, state.configuration.minimumBidDollars)
  );
  byTeam.set(team.id, hasAlternative);
  return hasAlternative;
};

export const bestPositiveStarterFallbackFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  position: string,
): GenericAuctionMockBoardPlayer | undefined => state.board.players
  .filter(candidate =>
    candidate.position === position
    && candidate.status !== "sold"
    && projectedWeeklyProductionFor(candidate) > 0
    && canAcquire(state, team, candidate, state.configuration.minimumBidDollars)
  )
  .sort((left, right) =>
    projectedWeeklyProductionFor(right) - projectedWeeklyProductionFor(left)
    || projectedSeasonProductionFor(right) - projectedSeasonProductionFor(left)
    || right.expectedPrice - left.expectedPrice
    || left.id.localeCompare(right.id)
  )[0];
