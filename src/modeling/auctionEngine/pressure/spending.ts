import type { Player } from "../../../types.js";
import type { AuctionOwnerState } from "../auctionContracts.js";
import type { AuctionEngineConfig } from "../configContracts.js";
import { clamp } from "../coreMath.js";

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

  const phaseSpan = Math.max(
    1,
    pressure.startRosterSlotsRemaining - pressure.minRosterSlotsRemainingExclusive,
  );
  const phase = clamp(
    (pressure.startRosterSlotsRemaining - state.rosterSlotsRemaining + 1) / phaseSpan,
    0,
    1,
  );
  const excessBudgetRatio = (budgetPerSlot - pressure.targetBudgetPerSlot) /
    pressure.targetBudgetPerSlot;
  return clamp(1 + excessBudgetRatio * phase * pressure.slope, 1, pressure.maxMultiplier);
};

export const budgetPacingMultiplierFor = (
  state: AuctionOwnerState,
  player: Player,
  config: AuctionEngineConfig,
): number => {
  if (player.price < config.budgetPacing.minimumPlayerPrice) return 1;
  if (state.rosterSlotsRemaining <= 1) return 1;
  const target = config.budgetPacing.targetBudgetPerSlotAfterPurchase;
  if (target <= 0) return 1;
  const expectedSpend = Math.min(state.maxBid, player.price);
  const budgetPerSlot = (state.budgetRemaining - expectedSpend) /
    (state.rosterSlotsRemaining - 1);
  if (budgetPerSlot >= target) return 1;
  const shortageRatio = (target - budgetPerSlot) / target;
  const discount = clamp(
    shortageRatio * config.budgetPacing.slope,
    0,
    config.budgetPacing.maxDiscount,
  );
  return 1 - discount;
};
