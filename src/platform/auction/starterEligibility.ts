import { analysisCacheFor } from "./analysisCache.js";
import { auctionClearingPriceCushionDollars } from "./pricingConstants.js";
import { assignableSlotFor, canAcquire } from "./roster.js";
import type {
  GenericAuctionMockBoardPlayer,
  GenericAuctionMockPlayer,
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "./types.js";

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

export const hasProjectedRbOrWrAlternative = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
): boolean => {
  const byTeam = analysisCacheFor(state).projectedRbOrWrAlternativeByTeamId;
  const cached = byTeam.get(team.id);
  if (cached !== undefined) return cached;

  const hasAlternative = state.board.players.some(candidate =>
    candidate.status === "available"
    && (candidate.position === "RB" || candidate.position === "WR")
    && projectedWeeklyProductionFor(candidate) > 0
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

export const maximumAutomatedAuctionBidFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
): number => {
  const assignedSlot = assignableSlotFor(team, player);
  if (assignedSlot === undefined) return 0;

  const remainingSlots = team.slots.filter(slot =>
    slot.playerId === undefined && slot.slot !== assignedSlot.slot
  );
  let reserve = remainingSlots.length * state.configuration.minimumBidDollars;
  const positionsNeedingStarterEligiblePlayers = new Set(remainingSlots
    .filter(slot => slot.eligiblePositions.length === 1)
    .map(slot => slot.eligiblePositions[0])
    .filter((position): position is string => position !== undefined));

  for (const position of positionsNeedingStarterEligiblePlayers) {
    const needed = remainingSlots.filter(slot =>
      slot.eligiblePositions.length === 1 && slot.eligiblePositions[0] === position
    ).length;
    const affordableStarters = remainingStarterEligiblePlayersFor(state, position)
      .filter(candidate => candidate.id !== player.id)
      .sort((left, right) =>
        left.expectedPrice - right.expectedPrice
        || projectedWeeklyProductionFor(right) - projectedWeeklyProductionFor(left)
        || left.id.localeCompare(right.id)
      )
      .slice(0, needed);
    if (affordableStarters.length < needed) continue;

    reserve += affordableStarters.reduce((total, starter) => total + Math.max(
      0,
      Math.round(starter.expectedPrice)
        + auctionClearingPriceCushionDollars
        - state.configuration.minimumBidDollars,
    ), 0);
  }

  return Math.max(0, team.budgetRemaining - reserve);
};
