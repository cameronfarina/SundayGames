import type {
  SimulationHardLock,
  SimulationSoftTarget,
  SimulationStrategy,
} from "../simulations.js";
import { isRecord } from "./json.js";

const hardLocksFromDb = (value: unknown): SimulationHardLock[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap(hardLock => {
    if (!isRecord(hardLock)) return [];
    const playerName = hardLock.playerName;
    const price = hardLock.price;
    if (typeof playerName !== "string" || typeof price !== "number") return [];
    return [{
      playerName,
      price,
      priceMode: hardLock.priceMode === "ceiling" ? "ceiling" : "exact",
      auctionOwner: typeof hardLock.auctionOwner === "string"
        ? hardLock.auctionOwner
        : undefined,
    }];
  });
};

const softTargetsFromDb = (value: unknown): SimulationSoftTarget[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap(softTarget => {
    if (!isRecord(softTarget)) return [];
    const label = softTarget.label;
    const maxBid = softTarget.maxBid;
    const candidatePool = softTarget.candidatePool;
    if (
      typeof label !== "string"
      || typeof maxBid !== "number"
      || !Array.isArray(candidatePool)
    ) return [];
    return [{
      label,
      candidatePool: candidatePool.filter(
        (candidate): candidate is string => typeof candidate === "string",
      ),
      maxBid,
    }];
  });
};

export const strategyFromDb = (value: unknown): SimulationStrategy => {
  if (!isRecord(value)) return { hardLocks: [], softTargets: [] };
  return {
    hardLocks: hardLocksFromDb(value.hardLocks),
    softTargets: softTargetsFromDb(value.softTargets),
  };
};
