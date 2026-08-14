import { describe, expect, it } from "vitest";
import {
  InMemorySimulationRepository,
  SimulationError,
} from "../../src/platform/simulations.js";
import { baseRequestInput, now } from "./support.js";

describe("private simulation validation", () => {
  it("validates run count, hard-lock players, prices, and duplicate hard locks", () => {
    const repository = new InMemorySimulationRepository();
    expect(() => repository.createRequest({
      ...baseRequestInput, count: 0, createdAt: now,
    })).toThrow(new SimulationError("invalid_count", "Simulation count must be at least 1."));
    expect(() => repository.createRequest({
      ...baseRequestInput, count: 101, createdAt: now,
    })).toThrow(new SimulationError("invalid_count", "Simulation count cannot exceed 100."));
    expect(() => repository.createRequest({
      ...baseRequestInput,
      idempotencyKey: "missing-player",
      strategy: {
        hardLocks: [{ playerName: " ", price: 13, auctionOwner: "Owner11" }],
        softTargets: [],
      },
      createdAt: now,
    })).toThrow(new SimulationError(
      "missing_hard_lock_player",
      "Hard locks must include a player name.",
    ));
    expect(() => repository.createRequest({
      ...baseRequestInput,
      idempotencyKey: "invalid-price",
      strategy: {
        hardLocks: [{ playerName: "Jadarian Price", price: 0, auctionOwner: "Owner11" }],
        softTargets: [],
      },
      createdAt: now,
    })).toThrow(new SimulationError(
      "invalid_hard_lock_price",
      "Hard lock for Jadarian Price must use a positive whole-dollar price.",
    ));
    expect(() => repository.createRequest({
      ...baseRequestInput,
      idempotencyKey: "duplicate-lock",
      strategy: {
        hardLocks: [
          { playerName: "Jadarian Price", price: 13, auctionOwner: "Owner11" },
          { playerName: " jadarian price ", price: 14, auctionOwner: "Owner11" },
        ],
        softTargets: [],
      },
      createdAt: now,
    })).toThrow(new SimulationError(
      "duplicate_hard_lock",
      "Hard lock duplicates Jadarian Price.",
    ));
    expect(() => repository.createRequest({
      ...baseRequestInput,
      idempotencyKey: "empty-target-label",
      strategy: {
        hardLocks: [],
        softTargets: [{ label: " ", candidatePool: ["Ladd McConkey"], maxBid: 21 }],
      },
      createdAt: now,
    })).toThrow(new SimulationError(
      "invalid_soft_target_label",
      "Soft targets must include a label.",
    ));
    expect(() => repository.createRequest({
      ...baseRequestInput,
      idempotencyKey: "empty-target-pool",
      strategy: {
        hardLocks: [],
        softTargets: [{ label: "value WRs", candidatePool: [" "], maxBid: 21 }],
      },
      createdAt: now,
    })).toThrow(new SimulationError(
      "invalid_soft_target_candidate_pool",
      "Soft target value WRs must include at least one candidate.",
    ));
    expect(() => repository.createRequest({
      ...baseRequestInput,
      idempotencyKey: "invalid-target-max",
      strategy: {
        hardLocks: [],
        softTargets: [{ label: "value WRs", candidatePool: ["Ladd McConkey"], maxBid: 0 }],
      },
      createdAt: now,
    })).toThrow(new SimulationError(
      "invalid_soft_target_max_bid",
      "Soft target value WRs must use a positive whole-dollar max bid.",
    ));
  });
});
