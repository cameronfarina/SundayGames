import type { Player } from "../../types.js";
import { AuctionOwnerState } from "./auctionContracts.js";
import { AuctionEngineConfig } from "./configContracts.js";
import { countPositions } from "./ownerStates.js";
import { preservesRemainingPlayerTargetsAfterAdding } from "./playerTargets.js";
import { canOwnerCompleteRosterAfterAdding, remainingPlayersAtPosition } from "./rosterRules.js";

export const canLeagueStillMeetPositionMinimumsWithCount = (
  candidateState: AuctionOwnerState,
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayersAtPlayerPosition: number,
  config: AuctionEngineConfig,
): boolean => {
  const positionMinimum = config.starterMinimums[player.position];
  if (positionMinimum <= 0) return true;

  const directShortageAfterPick = ownerStates.reduce((shortage, state) => {
    const counts = countPositions(state.roster);
    if (state.owner === candidateState.owner) counts[player.position] += 1;
    return shortage + Math.max(0, positionMinimum - counts[player.position]);
  }, 0);

  return remainingPlayersAtPlayerPosition >= directShortageAfterPick;
};

export const ownerCanBidOnPlayerWithCount = (
  state: AuctionOwnerState,
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayersAtPlayerPosition: number,
  config: AuctionEngineConfig,
): boolean =>
  state.maxBid >= config.minimumBid &&
  canOwnerCompleteRosterAfterAdding(state, player, config) &&
  canLeagueStillMeetPositionMinimumsWithCount(
    state,
    player,
    ownerStates,
    remainingPlayersAtPlayerPosition,
    config,
  );

export const ownerCanBidOnPlayer = (
  state: AuctionOwnerState,
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig,
): boolean =>
  ownerCanBidOnPlayerWithCount(
    state,
    player,
    ownerStates,
    remainingPlayersAtPosition(remainingPlayers, player.position),
    config,
  ) &&
  preservesRemainingPlayerTargetsAfterAdding(state, player, remainingPlayers, config);
