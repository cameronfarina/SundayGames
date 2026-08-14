import { positions, type Owner, type Position } from "../../../config/league.js";
import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { Player } from "../../types.js";
import { AuctionOwnerState } from "./auctionContracts.js";
import { AuctionEngineConfig, PositionAmounts } from "./configContracts.js";
import { flexEligiblePositions } from "./constants.js";
import { rosterMaximumFor } from "./coreMath.js";
import { countPositions } from "./ownerStates.js";

export const directMissingTotal = (
  counts: PositionAmounts,
  starterMinimums: PositionAmounts,
): number =>
  positions.reduce(
    (total, position) => total + Math.max(0, starterMinimums[position] - counts[position]),
    0,
  );

export const directMissingFlexEligible = (
  counts: PositionAmounts,
  starterMinimums: PositionAmounts,
): number =>
  flexEligiblePositions.reduce(
    (total, position) => total + Math.max(0, starterMinimums[position] - counts[position]),
    0,
  );

export const flexEligibleCount = (counts: PositionAmounts): number =>
  flexEligiblePositions.reduce((total, position) => total + counts[position], 0);

export const minimumFlexEligibleCount = (config: AuctionEngineConfig): number =>
  flexEligiblePositions.reduce(
    (total, position) => total + config.starterMinimums[position],
    config.flexMinimum,
  );

export const futurePicksNeededForLegalRoster = (
  counts: PositionAmounts,
  config: AuctionEngineConfig,
): number => {
  const missingDirect = directMissingTotal(counts, config.starterMinimums);
  const flexCountAfterDirectMinimums = flexEligibleCount(counts) +
    directMissingFlexEligible(counts, config.starterMinimums);
  const extraFlexShortage = Math.max(
    0,
    minimumFlexEligibleCount(config) - flexCountAfterDirectMinimums,
  );

  return missingDirect + extraFlexShortage;
};

export const canOwnerCompleteRosterAfterAddingPositionSlots = (
  state: AuctionOwnerState,
  position: Position,
  slotCount: number,
  config: AuctionEngineConfig,
): boolean => {
  if (slotCount <= 0) return true;
  if (state.rosterSlotsRemaining < slotCount) return false;

  const counts = countPositions(state.roster);
  if (counts[position] + slotCount > rosterMaximumFor(state.owner, position, config)) return false;

  counts[position] += slotCount;
  const slotsAfterPick = state.rosterSlotsRemaining - slotCount;
  return futurePicksNeededForLegalRoster(counts, config) <= slotsAfterPick;
};

export const canOwnerCompleteRosterAfterAdding = (
  state: AuctionOwnerState,
  player: Player,
  config: AuctionEngineConfig,
): boolean =>
  canOwnerCompleteRosterAfterAddingPositionSlots(state, player.position, 1, config);

export const remainingPlayersAtPosition = (
  remainingPlayers: readonly Player[],
  position: Position,
): number =>
  remainingPlayers.filter(player => player.position === position).length;

export const playerTargetKey = (name: string): string =>
  normalizePlayerName(name).toLowerCase();

export const configuredPlayerTargetMaxBidFor = (
  owner: Owner,
  playerName: string,
  config: AuctionEngineConfig,
): number | undefined => {
  const targetMaxBids = config.ownerPlayerTargetMaxBids[owner];
  if (!targetMaxBids) return undefined;

  const normalizedName = normalizePlayerName(playerName);
  const directMatch = targetMaxBids[normalizedName];
  if (directMatch !== undefined) return directMatch;

  const searchKey = playerTargetKey(playerName);
  return Object.entries(targetMaxBids)
    .find(([targetName]) => playerTargetKey(targetName) === searchKey)
    ?.[1];
};
