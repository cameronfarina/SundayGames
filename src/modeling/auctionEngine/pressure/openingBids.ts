import type { Owner } from "../../../../config/league.js";
import type { Player } from "../../../types.js";
import type { AuctionOwnerState } from "../auctionContracts.js";
import { ownerCanBidOnPlayer } from "../bidEligibility.js";
import type { AuctionEngineConfig } from "../configContracts.js";
import {
  budgetFlushBidStartRosterSlotsRemaining,
  budgetFlushTargetEndingBudget,
} from "../constants.js";
import { clamp } from "../coreMath.js";

export const lateOpeningBidFor = (
  state: AuctionOwnerState,
  player: Player,
  config: AuctionEngineConfig,
): number => {
  const openingBid = config.lateOpeningBid;
  if (state.rosterSlotsRemaining <= 0) return 0;
  if (state.rosterSlotsRemaining > openingBid.startRosterSlotsRemaining) return 0;
  if (player.price > openingBid.maxPlayerPrice) return 0;
  const excessBudget = state.budgetRemaining -
    state.rosterSlotsRemaining * openingBid.targetBudgetPerSlot;
  if (excessBudget <= 0) return 0;
  const urgency = (
    openingBid.startRosterSlotsRemaining - state.rosterSlotsRemaining + 1
  ) / openingBid.startRosterSlotsRemaining;
  const extraBid = Math.floor(Math.min(openingBid.maxExtraBid, excessBudget * urgency));
  return extraBid <= 0
    ? 0
    : clamp(player.price + extraBid, config.minimumBid, state.maxBid);
};

export const lateOpeningBidForNominator = (
  nominator: Owner | undefined,
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig,
): number => {
  if (!nominator) return 0;
  const state = ownerStates.find(candidate => candidate.owner === nominator);
  if (!state || !ownerCanBidOnPlayer(state, player, ownerStates, remainingPlayers, config)) {
    return 0;
  }
  return lateOpeningBidFor(state, player, config);
};

export const budgetFlushCushionedMaxBidFor = (
  state: AuctionOwnerState,
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig,
): number | undefined => {
  if (state.rosterSlotsRemaining <= 0) return undefined;
  if (state.rosterSlotsRemaining > budgetFlushBidStartRosterSlotsRemaining) return undefined;
  if (remainingPlayers.length < config.owners.length) return undefined;
  const slotsAfterPurchase = Math.max(0, state.rosterSlotsRemaining - 1);
  const cushionedMaxBid = state.budgetRemaining -
    slotsAfterPurchase * config.minimumBid - budgetFlushTargetEndingBudget;
  return cushionedMaxBid < config.minimumBid
    ? undefined
    : Math.min(state.maxBid, cushionedMaxBid);
};

export const budgetFlushBidFor = (
  state: AuctionOwnerState,
  player: Player,
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig,
): number => {
  const maximum = budgetFlushCushionedMaxBidFor(state, remainingPlayers, config);
  if (maximum === undefined || maximum <= player.price) return 0;
  const urgency = (
    budgetFlushBidStartRosterSlotsRemaining - state.rosterSlotsRemaining + 1
  ) / budgetFlushBidStartRosterSlotsRemaining;
  const floor = player.price + Math.floor((maximum - player.price) * urgency);
  return clamp(floor, config.minimumBid, maximum);
};
