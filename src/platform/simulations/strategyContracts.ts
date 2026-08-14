import type { Owner } from "../../../config/league.js";

export type SimulationPriceMode = "exact" | "ceiling";

export interface SimulationHardLockInput {
  playerName: string;
  price: number;
  priceMode?: SimulationPriceMode;
  auctionOwner?: Owner;
}

export interface SimulationHardLock {
  playerName: string;
  price: number;
  priceMode: SimulationPriceMode;
  auctionOwner: Owner | undefined;
}

export interface SimulationSoftTargetInput {
  label: string;
  candidatePool: readonly string[];
  maxBid: number;
}

export interface SimulationSoftTarget {
  label: string;
  candidatePool: readonly string[];
  maxBid: number;
}

export interface SimulationStrategyInput {
  hardLocks?: readonly SimulationHardLockInput[];
  softTargets?: readonly SimulationSoftTargetInput[];
}

export interface SimulationStrategy {
  hardLocks: readonly SimulationHardLock[];
  softTargets: readonly SimulationSoftTarget[];
}
