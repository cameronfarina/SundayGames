import { analysisCacheFor } from "./analysisCache.js";
import { canAcquire, rosterNeedFor } from "./roster.js";
import { isAutomatedAuctionAcquisitionEligible } from "./starterEligibility.js";
import type {
  GenericAuctionMockPlayer,
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "./types.js";

export const eligibleAiTeamsFor = (
  state: GenericAuctionMockState,
  player: GenericAuctionMockPlayer,
): readonly GenericAuctionMockTeamReadModel[] => {
  const byPlayer = analysisCacheFor(state).eligibleAiTeamsByPlayerId;
  const cached = byPlayer.get(player.id);
  if (cached !== undefined) return cached;

  const eligible = state.teams.filter(team =>
    !team.isHuman
    && canAcquire(state, team, player, state.configuration.minimumBidDollars)
    && isAutomatedAuctionAcquisitionEligible(state, team, player)
  );
  byPlayer.set(player.id, eligible);
  return eligible;
};

export const averageRosterNeedFor = (
  teams: readonly GenericAuctionMockTeamReadModel[],
  position: string,
): number => teams.length === 0
  ? 0
  : teams.reduce((total, team) => total + rosterNeedFor(team, position), 0) / teams.length;

export const positionScarcityMultiplierFor = (
  state: GenericAuctionMockState,
  player: GenericAuctionMockPlayer,
): number => {
  const originalSupply = state.configuration.players
    .filter(candidate => candidate.position === player.position)
    .length;
  const remainingSupply = state.board.players.filter(candidate =>
    candidate.position === player.position && candidate.status !== "sold"
  ).length;
  if (originalSupply === 0 || remainingSupply === 0) return 1;

  const depletion = Math.max(0, 1 - remainingSupply / originalSupply);
  const openDemand = state.teams.reduce(
    (total, team) => total + rosterNeedFor(team, player.position),
    0,
  );
  const demandPressure = Math.min(1, openDemand / remainingSupply);

  return 1 + depletion * demandPressure * 0.15;
};

// What one open roster slot can still expect to buy: the top remaining
// values, one per open slot, averaged across the room. When the room's
// spare cash per slot exceeds this, prices must rise to clear the money.
export const remainingValuePerSlotFor = (state: GenericAuctionMockState): number => {
  const cache = analysisCacheFor(state);
  if (cache.remainingValuePerSlot !== undefined) return cache.remainingValuePerSlot;
  const openSlots = state.teams.reduce((total, team) => total + team.rosterSlotsRemaining, 0);
  const topValues = openSlots <= 0 ? [] : state.board.players
    .filter(player => player.status !== "sold")
    .map(player => player.expectedPrice)
    .sort((left, right) => right - left)
    .slice(0, openSlots);
  const valuePerSlot = topValues.length === 0
    ? 0
    : topValues.reduce((total, value) => total + value, 0) / openSlots;
  cache.remainingValuePerSlot = valuePerSlot;
  return valuePerSlot;
};
