import { describe, expect, it } from "vitest";
import {
  maximumSimulationCandidatePoolSize,
  maximumSimulationHardLocks,
  maximumSimulationIdentifierLength,
  maximumSimulationSoftTargets,
  maximumSimulationStrategyElementLength,
  maximumStructuredSimulationStrategyCharacters,
} from "../src/platform/simulationLimits.js";
import {
  InMemorySimulationRepository,
  SimulationError,
} from "../src/platform/simulations.js";

const now = new Date("2026-08-13T18:00:00.000Z");

const requestInput = (idempotencyKey: string) => ({
  userId: "user_cam",
  leagueId: "league_100001",
  seasonId: "season_2026",
  ownerId: "owner_cam",
  teamId: "team_cam",
  count: 25,
  seedPrefix: "balanced",
  idempotencyKey,
  strategy: {},
  createdAt: now,
});

describe("simulation admission limits", () => {
  it("rejects oversized structured strategy dimensions and text before storage", () => {
    const repository = new InMemorySimulationRepository();
    const playerName = "x".repeat(maximumSimulationStrategyElementLength + 1);

    expect(() => repository.createRequest({
      ...requestInput("too-many-locks"),
      strategy: {
        hardLocks: Array.from(
          { length: maximumSimulationHardLocks + 1 },
          (_, index) => ({ playerName: `Player ${index}`, price: 1 }),
        ),
      },
    })).toThrow(new SimulationError(
      "simulation_strategy_too_large",
      `Simulation strategy cannot contain more than ${maximumSimulationHardLocks} hard locks.`,
    ));

    expect(() => repository.createRequest({
      ...requestInput("too-many-targets"),
      strategy: {
        softTargets: Array.from(
          { length: maximumSimulationSoftTargets + 1 },
          (_, index) => ({ label: `Target ${index}`, candidatePool: ["Player"], maxBid: 1 }),
        ),
      },
    })).toThrow(new SimulationError(
      "simulation_strategy_too_large",
      `Simulation strategy cannot contain more than ${maximumSimulationSoftTargets} soft targets.`,
    ));

    expect(() => repository.createRequest({
      ...requestInput("too-many-candidates"),
      strategy: {
        softTargets: [{
          label: "RB value",
          candidatePool: Array.from(
            { length: maximumSimulationCandidatePoolSize + 1 },
            (_, index) => `Player ${index}`,
          ),
          maxBid: 20,
        }],
      },
    })).toThrow(new SimulationError(
      "simulation_strategy_too_large",
      `A soft target cannot contain more than ${maximumSimulationCandidatePoolSize} candidates.`,
    ));

    expect(() => repository.createRequest({
      ...requestInput("long-player-name"),
      strategy: { hardLocks: [{ playerName, price: 1 }] },
    })).toThrow(new SimulationError(
      "simulation_strategy_too_large",
      `A simulation strategy name cannot exceed ${maximumSimulationStrategyElementLength} characters.`,
    ));

    expect(() => repository.createRequest({
      ...requestInput("too-much-total-text"),
      strategy: {
        softTargets: Array.from({ length: maximumSimulationSoftTargets }, (_, targetIndex) => ({
          label: `Target ${targetIndex}`,
          candidatePool: Array.from(
            { length: maximumSimulationCandidatePoolSize },
            (_, playerIndex) => `${targetIndex}-${playerIndex}-${"x".repeat(150)}`,
          ),
          maxBid: 20,
        })),
      },
    })).toThrow(new SimulationError(
      "simulation_strategy_too_large",
      `Structured simulation strategy text cannot exceed ${maximumStructuredSimulationStrategyCharacters} characters.`,
    ));
  });

  it("bounds identifiers and preserves normal 25-run requests", () => {
    const repository = new InMemorySimulationRepository();

    expect(() => repository.createRequest({
      ...requestInput("long-seed"),
      seedPrefix: "s".repeat(maximumSimulationIdentifierLength + 1),
    })).toThrow(new SimulationError(
      "invalid_simulation_identifier",
      `Simulation seed prefix cannot exceed ${maximumSimulationIdentifierLength} characters.`,
    ));
    expect(() => repository.createRequest(requestInput(
      "i".repeat(maximumSimulationIdentifierLength + 1),
    ))).toThrow(new SimulationError(
      "invalid_simulation_identifier",
      `Simulation idempotency key cannot exceed ${maximumSimulationIdentifierLength} characters.`,
    ));
    expect(() => repository.createRequest(requestInput("   "))).toThrow(new SimulationError(
      "invalid_simulation_identifier",
      "Simulation idempotency key is required.",
    ));

    expect(repository.createRequest(requestInput("normal-25-run"))).toMatchObject({
      status: "requested",
      request: { count: 25 },
    });
  });

});
