import type { Owner, Position } from "../../../config/league.js";
import type { Player } from "../../types.js";
import { AuctionOwnerState } from "./auctionContracts.js";
import { ownerCanBidOnPlayer } from "./bidEligibility.js";
import { AuctionEngineConfig } from "./configContracts.js";
import { budgetFlushBidStartRosterSlotsRemaining, budgetFlushTargetEndingBudget } from "./constants.js";
import { clamp, isFlexEligible, isPremiumPosition } from "./coreMath.js";
import { countPositions } from "./ownerStates.js";
import { flexEligibleCount, minimumFlexEligibleCount } from "./rosterRules.js";

export const endgamePressureMultiplierFor = (
  state: AuctionOwnerState,
  config: AuctionEngineConfig,
): number => {
  if (state.rosterSlotsRemaining <= 0) return 1;
  if (state.rosterSlotsRemaining > config.endgameSpend.startRosterSlotsRemaining) return 1;

  const budgetPerSlot = state.budgetRemaining / state.rosterSlotsRemaining;
  if (budgetPerSlot <= config.endgameSpend.targetBudgetPerSlot) return 1;

  const excessBudgetRatio = (budgetPerSlot - config.endgameSpend.targetBudgetPerSlot) /
    config.endgameSpend.targetBudgetPerSlot;
  const urgency = (
    config.endgameSpend.startRosterSlotsRemaining - state.rosterSlotsRemaining + 1
  ) / config.endgameSpend.startRosterSlotsRemaining;

  return clamp(
    1 + excessBudgetRatio * urgency * config.endgameSpend.slope,
    1,
    config.endgameSpend.maxMultiplier,
  );
};

export const roomPressureMultiplierFor = (
  state: AuctionOwnerState,
  player: Player,
  config: AuctionEngineConfig,
): number => {
  const pressure = config.roomPressure;
  if (state.rosterSlotsRemaining <= pressure.minRosterSlotsRemainingExclusive) return 1;
  if (state.rosterSlotsRemaining > pressure.startRosterSlotsRemaining) return 1;
  if (player.price < pressure.minimumPlayerPrice || player.price > pressure.maximumPlayerPrice) return 1;
  if (state.rosterSlotsRemaining <= 0 || pressure.targetBudgetPerSlot <= 0) return 1;

  const budgetPerSlot = state.budgetRemaining / state.rosterSlotsRemaining;
  if (budgetPerSlot <= pressure.targetBudgetPerSlot) return 1;

  const phaseSpan = Math.max(1, pressure.startRosterSlotsRemaining - pressure.minRosterSlotsRemainingExclusive);
  const phase = clamp(
    (pressure.startRosterSlotsRemaining - state.rosterSlotsRemaining + 1) / phaseSpan,
    0,
    1,
  );
  const excessBudgetRatio = (budgetPerSlot - pressure.targetBudgetPerSlot) / pressure.targetBudgetPerSlot;

  return clamp(
    1 + excessBudgetRatio * phase * pressure.slope,
    1,
    pressure.maxMultiplier,
  );
};

export const positionNeedTypeFor = (
  state: AuctionOwnerState,
  position: Position,
  config: AuctionEngineConfig,
): "starter" | "flex" | undefined => {
  const counts = countPositions(state.roster);
  if (counts[position] < config.starterMinimums[position]) return "starter";
  if (isFlexEligible(position) && flexEligibleCount(counts) < minimumFlexEligibleCount(config)) return "flex";

  return undefined;
};

export const rivalAnchorCountFor = (
  state: AuctionOwnerState,
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig,
): number => {
  const pressure = config.competitionPressure;
  const anchorPrice = Math.max(
    pressure.minimumPlayerPrice,
    Math.ceil(player.price * pressure.anchorPriceRatio),
  );

  return ownerStates.filter(rival =>
    rival.owner !== state.owner &&
    rival.roster.some(rosteredPlayer =>
      rosteredPlayer.position === player.position &&
      rosteredPlayer.price >= anchorPrice
    ) &&
    ownerCanBidOnPlayer(rival, player, ownerStates, remainingPlayers, config)
  ).length;
};

export const competitionPressureMultiplierFor = (
  state: AuctionOwnerState,
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig,
): number => {
  const pressure = config.competitionPressure;
  if (!isPremiumPosition(player.position)) return 1;
  if (player.price < pressure.minimumPlayerPrice) return 1;

  const needType = positionNeedTypeFor(state, player.position, config);
  if (!needType) return 1;

  const rivalAnchors = Math.min(
    pressure.maxRivalAnchors,
    rivalAnchorCountFor(state, player, ownerStates, remainingPlayers, config),
  );
  if (rivalAnchors <= 0) return 1;

  const slope = needType === "starter"
    ? pressure.missingStarterSlope
    : pressure.missingFlexSlope;

  return clamp(
    1 + rivalAnchors * slope,
    1,
    pressure.maxMultiplier,
  );
};

export const budgetPacingMultiplierFor = (
  state: AuctionOwnerState,
  player: Player,
  config: AuctionEngineConfig,
): number => {
  if (player.price < config.budgetPacing.minimumPlayerPrice) return 1;
  if (state.rosterSlotsRemaining <= 1) return 1;
  if (config.budgetPacing.targetBudgetPerSlotAfterPurchase <= 0) return 1;

  const expectedSpend = Math.min(state.maxBid, player.price);
  const slotsAfterPurchase = state.rosterSlotsRemaining - 1;
  const budgetAfterPurchase = state.budgetRemaining - expectedSpend;
  const budgetPerSlotAfterPurchase = budgetAfterPurchase / slotsAfterPurchase;
  const targetBudgetPerSlot = config.budgetPacing.targetBudgetPerSlotAfterPurchase;
  if (budgetPerSlotAfterPurchase >= targetBudgetPerSlot) return 1;

  const shortageRatio = (targetBudgetPerSlot - budgetPerSlotAfterPurchase) / targetBudgetPerSlot;
  const discount = clamp(shortageRatio * config.budgetPacing.slope, 0, config.budgetPacing.maxDiscount);
  return 1 - discount;
};

export const lateOpeningBidFor = (
  state: AuctionOwnerState,
  player: Player,
  config: AuctionEngineConfig,
): number => {
  const openingBid = config.lateOpeningBid;
  if (state.rosterSlotsRemaining <= 0) return 0;
  if (state.rosterSlotsRemaining > openingBid.startRosterSlotsRemaining) return 0;
  if (player.price > openingBid.maxPlayerPrice) return 0;

  const targetBudget = state.rosterSlotsRemaining * openingBid.targetBudgetPerSlot;
  const excessBudget = state.budgetRemaining - targetBudget;
  if (excessBudget <= 0) return 0;

  const urgency = (
    openingBid.startRosterSlotsRemaining - state.rosterSlotsRemaining + 1
  ) / openingBid.startRosterSlotsRemaining;
  const extraBid = Math.floor(Math.min(openingBid.maxExtraBid, excessBudget * urgency));
  if (extraBid <= 0) return 0;

  return clamp(player.price + extraBid, config.minimumBid, state.maxBid);
};

export const lateOpeningBidForNominator = (
  nominator: Owner | undefined,
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig,
): number => {
  if (!nominator) return 0;

  const nominatorState = ownerStates.find(state => state.owner === nominator);
  if (!nominatorState) return 0;
  if (!ownerCanBidOnPlayer(nominatorState, player, ownerStates, remainingPlayers, config)) return 0;

  return lateOpeningBidFor(nominatorState, player, config);
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
  const cushionedMaxBid =
    state.budgetRemaining - slotsAfterPurchase * config.minimumBid - budgetFlushTargetEndingBudget;
  if (cushionedMaxBid < config.minimumBid) return undefined;

  return Math.min(state.maxBid, cushionedMaxBid);
};

export const budgetFlushBidFor = (
  state: AuctionOwnerState,
  player: Player,
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig,
): number => {
  const maximumUsefulBid = budgetFlushCushionedMaxBidFor(state, remainingPlayers, config);
  if (maximumUsefulBid === undefined) return 0;
  if (maximumUsefulBid <= player.price) return 0;

  const urgency = (
    budgetFlushBidStartRosterSlotsRemaining - state.rosterSlotsRemaining + 1
  ) / budgetFlushBidStartRosterSlotsRemaining;
  const bidFloor = player.price + Math.floor((maximumUsefulBid - player.price) * urgency);

  return clamp(bidFloor, config.minimumBid, maximumUsefulBid);
};
