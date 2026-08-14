import { GenericAuctionMockError } from "./errors.js";
import type {
  GenericAuctionMockBoardPlayer,
  GenericAuctionMockConfig,
  GenericAuctionMockPlayer,
  GenericAuctionMockRosterSlot,
  GenericAuctionMockRosterSlotConfig,
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "./types.js";

export const expandedRosterSlotName = (
  slot: GenericAuctionMockRosterSlotConfig,
  index: number,
): string => slot.count === 1 ? slot.slot : `${slot.slot}${index + 1}`;

export const rosterCapacityFor = (config: GenericAuctionMockConfig): number =>
  config.rosterSlots.reduce((total, slot) => total + slot.count, 0);

export const maxBidFor = (
  budgetRemaining: number,
  rosterSlotsRemaining: number,
  minimumBid: number,
): number => rosterSlotsRemaining <= 0
  ? 0
  : Math.max(0, budgetRemaining - Math.max(0, rosterSlotsRemaining - 1) * minimumBid);

export const positionKeysFor = (config: GenericAuctionMockConfig): readonly string[] =>
  Object.keys(config.positionMaximums);

export const emptyPositionCounts = (
  config: GenericAuctionMockConfig,
): Readonly<Record<string, number>> => Object.fromEntries(
  positionKeysFor(config).map(position => [position, 0]),
);

export const buildRosterSlots = (
  config: GenericAuctionMockConfig,
): readonly GenericAuctionMockRosterSlot[] => config.rosterSlots.flatMap(slot =>
  Array.from({ length: slot.count }, (_, index) => ({
    slot: expandedRosterSlotName(slot, index),
    eligiblePositions: [...slot.eligiblePositions],
    playerId: undefined,
  })),
);

export const teamFor = (
  state: GenericAuctionMockState,
  teamId: string,
): GenericAuctionMockTeamReadModel => {
  const team = state.teams.find(candidate => candidate.id === teamId);
  if (team === undefined) {
    throw new GenericAuctionMockError("team_not_found", `Unknown auction team "${teamId}".`);
  }

  return team;
};

export const playerFor = (
  state: GenericAuctionMockState,
  playerId: string,
): GenericAuctionMockBoardPlayer => {
  const player = state.board.players.find(candidate => candidate.id === playerId);
  if (player === undefined) {
    throw new GenericAuctionMockError("player_not_found", `Unknown auction player "${playerId}".`);
  }

  return player;
};

export const assignableSlotFor = (
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
  preferFlexibleSlot = false,
): GenericAuctionMockRosterSlot | undefined => team.slots
  .filter(slot => slot.playerId === undefined && slot.eligiblePositions.includes(player.position))
  .sort((left, right) => {
    const flexibilityDifference = left.eligiblePositions.length - right.eligiblePositions.length;
    const preferredDifference = preferFlexibleSlot
      ? -flexibilityDifference
      : flexibilityDifference;
    return preferredDifference || left.slot.localeCompare(right.slot);
  })[0];

export const canAcquire = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
  price: number,
): boolean => Number.isInteger(price)
  && price >= state.configuration.minimumBidDollars
  && team.rosterSlotsRemaining > 0
  && price <= team.maxBid
  && (team.positionCounts[player.position] ?? 0)
    < (state.configuration.positionMaximums[player.position] ?? 0)
  && assignableSlotFor(team, player) !== undefined;

export const assertPrice = (state: GenericAuctionMockState, price: number): void => {
  if (!Number.isInteger(price) || price < state.configuration.minimumBidDollars) {
    throw new GenericAuctionMockError(
      "invalid_price",
      `Auction bids must be whole-dollar amounts of at least $${state.configuration.minimumBidDollars}.`,
    );
  }
};

export const assertCanAcquire = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
  price: number,
  preferFlexibleSlot = false,
): GenericAuctionMockRosterSlot => {
  assertPrice(state, price);

  if (team.rosterSlotsRemaining <= 0) {
    throw new GenericAuctionMockError("roster_full", `${team.name} has no open roster slots.`);
  }
  if (price > team.maxBid) {
    throw new GenericAuctionMockError(
      "max_bid_exceeded",
      `${team.name} cannot bid $${price}; its max bid is $${team.maxBid}.`,
    );
  }

  const maximum = state.configuration.positionMaximums[player.position] ?? 0;
  if ((team.positionCounts[player.position] ?? 0) >= maximum) {
    throw new GenericAuctionMockError(
      "position_limit",
      `${team.name} has reached its ${player.position} maximum of ${maximum}.`,
    );
  }

  const slot = assignableSlotFor(team, player, preferFlexibleSlot);
  if (slot === undefined) {
    throw new GenericAuctionMockError(
      "roster_limit",
      `${team.name} has no open roster slot eligible for ${player.position}.`,
    );
  }

  return slot;
};

export const rosterNeedFor = (
  team: GenericAuctionMockTeamReadModel,
  position: string,
): number => team.slots
  .filter(slot => slot.playerId === undefined && slot.eligiblePositions.includes(position))
  .reduce((total, slot) => total + (1 / slot.eligiblePositions.length), 0);
