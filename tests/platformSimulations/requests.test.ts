import { describe, expect, it } from "vitest";
import {
  InMemorySimulationRepository,
  SimulationError,
  canReadSimulationRun,
  executeSimulationRun,
} from "../../src/platform/simulations.js";
import { baseRequestInput, fakeBatch, now } from "./support.js";

describe("private simulation requests", () => {
  it("creates simulation requests idempotently for the same user league season and key", () => {
    const repository = new InMemorySimulationRepository();
    const firstRun = repository.createRequest({ ...baseRequestInput, createdAt: now });
    const secondRun = repository.createRequest({
      ...baseRequestInput,
      createdAt: new Date(now.getTime() + 1_000),
    });

    expect(secondRun).toBe(firstRun);
    expect(firstRun).toMatchObject({
      id: expect.stringMatching(/^sim_/),
      request: {
        userId: "user_cam",
        leagueId: "league_100001",
        seasonId: "season_2026",
        ownerId: "owner_cam",
        teamId: "team_cam",
        count: 25,
        seedPrefix: "owner11-balanced-rb3",
        idempotencyKey: "balanced-rb3",
        createdAt: now,
        privacyOwnerUserId: "user_cam",
      },
      status: "requested",
      createdAt: now,
      result: undefined,
    });
    expect(repository.listForUser("user_cam")).toEqual([firstRun]);
  });

  it("rejects an idempotency key reused with different simulation input", () => {
    const repository = new InMemorySimulationRepository();
    repository.createRequest({ ...baseRequestInput, createdAt: now });

    expect(() => repository.createRequest({
      ...baseRequestInput,
      count: 24,
      createdAt: new Date(now.getTime() + 1_000),
    })).toThrow(new SimulationError(
      "idempotency_conflict",
      "A simulation request already exists for this idempotency key with different input.",
    ));
  });

  it("only lets the private owner list or read their simulation results", async () => {
    const repository = new InMemorySimulationRepository();
    const camRun = repository.createRequest({ ...baseRequestInput, createdAt: now });
    const otherRun = repository.createRequest({
      ...baseRequestInput,
      userId: "user_other",
      ownerId: "owner_other",
      teamId: "team_other",
      idempotencyKey: "other-balanced-rb3",
      createdAt: now,
    });
    await executeSimulationRun({
      repository,
      runId: camRun.id,
      runner: fakeBatch,
      now: new Date(now.getTime() + 5_000),
    });
    await executeSimulationRun({
      repository,
      runId: otherRun.id,
      runner: fakeBatch,
      now: new Date(now.getTime() + 6_000),
    });

    expect(canReadSimulationRun("user_cam", camRun)).toBe(true);
    expect(canReadSimulationRun("user_other", camRun)).toBe(false);
    expect(repository.listForUser("user_cam").map(candidate => candidate.id)).toEqual([camRun.id]);
    expect(repository.fetchForUser(camRun.id, "user_other")).toBeNull();
    expect(repository.fetchForUser(camRun.id, "user_cam")).toBe(camRun);
  });
});
