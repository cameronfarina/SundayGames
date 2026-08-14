import { maximumSimulationHardLocks } from "../simulationLimits.js";
import { SimulationError } from "./errors.js";
import { assertSimulationStrategyText, normalizedPlayerKey } from "./strategyText.js";
import type { SimulationHardLock, SimulationHardLockInput } from "./strategyContracts.js";

export const normalizeHardLocks = (
  hardLocks: readonly SimulationHardLockInput[] = [],
): readonly SimulationHardLock[] => {
  if (hardLocks.length > maximumSimulationHardLocks) {
    throw new SimulationError(
      "simulation_strategy_too_large",
      `Simulation strategy cannot contain more than ${maximumSimulationHardLocks} hard locks.`,
    );
  }
  const seenPlayerNamesByKey = new Map<string, string>();
  const normalizedHardLocks: SimulationHardLock[] = [];

  for (const hardLock of hardLocks) {
    const playerName = hardLock.playerName.trim();
    assertSimulationStrategyText(playerName);
    if (playerName.length === 0) {
      throw new SimulationError("missing_hard_lock_player", "Hard locks must include a player name.");
    }
    if (!Number.isInteger(hardLock.price) || hardLock.price < 1) {
      throw new SimulationError(
        "invalid_hard_lock_price",
        `Hard lock for ${playerName} must use a positive whole-dollar price.`,
      );
    }

    const playerKey = normalizedPlayerKey(playerName);
    const firstPlayerName = seenPlayerNamesByKey.get(playerKey);
    if (firstPlayerName !== undefined) {
      throw new SimulationError("duplicate_hard_lock", `Hard lock duplicates ${firstPlayerName}.`);
    }
    seenPlayerNamesByKey.set(playerKey, playerName);
    normalizedHardLocks.push({
      playerName,
      price: hardLock.price,
      priceMode: hardLock.priceMode ?? "exact",
      auctionOwner: hardLock.auctionOwner,
    });
  }
  return normalizedHardLocks;
};
