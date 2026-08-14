import { describe, expect, it } from "vitest";
import {
  maximumRetainedSimulationRunsPerUser,
  maximumSimulationNoteLength,
  maximumSimulationStrategyTextLength,
} from "../src/platform/simulationLimits.js";
import {
  simulationAdmissionFixture,
  simulationAdmissionNow,
} from "./support/simulationAdmissionFixture.js";

describe("simulation HTTP admission", () => {
  it("returns typed 400 and 429 errors for malformed input and a saturated backlog", async () => {
    const { app, handle, sessionToken, season, team } = await simulationAdmissionFixture();
    await expect(handle({
      method: "POST",
      path: "/simulations",
      sessionToken,
      body: {
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: team.ownerId,
        teamId: team.id,
        count: 25,
        seedPrefix: "malformed",
        idempotencyKey: "malformed",
        strategy: { hardLocks: "many" },
      },
    })).resolves.toMatchObject({
      status: 400,
      body: { error: { code: "invalid_simulation_strategy" } },
    });
    await expect(handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken,
      body: {
        seasonId: season.id,
        count: 25,
        strategy: "s".repeat(maximumSimulationStrategyTextLength + 1),
      },
    })).resolves.toMatchObject({
      status: 400,
      body: { error: { code: "simulation_strategy_too_large" } },
    });
    await expect(handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken,
      body: {
        seasonId: season.id,
        count: 25,
        note: "n".repeat(maximumSimulationNoteLength + 1),
      },
    })).resolves.toMatchObject({
      status: 400,
      body: { error: { code: "simulation_strategy_too_large" } },
    });

    for (let index = 0; index < maximumRetainedSimulationRunsPerUser; index += 1) {
      await app.createSimulationRun({
        actorSessionToken: sessionToken,
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: team.ownerId,
        teamId: team.id,
        count: 25,
        seedPrefix: `active-${index}`,
        idempotencyKey: `active-${index}`,
        strategy: {},
      });
    }
    await expect(handle({
      method: "POST",
      path: "/simulations",
      sessionToken,
      body: {
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: team.ownerId,
        teamId: team.id,
        count: 25,
        seedPrefix: "over-cap",
        idempotencyKey: "over-cap",
        strategy: {},
      },
    })).resolves.toMatchObject({
      status: 429,
      headers: { "Retry-After": "5" },
      body: { error: { code: "simulation_capacity_reached" } },
    });
  });

  it("returns compact fixed-cap history while preserving selected-run detail", async () => {
    const { app, handle, sessionToken, season, team } = await simulationAdmissionFixture();
    const created = await app.createSimulationRun({
      actorSessionToken: sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: team.ownerId,
      teamId: team.id,
      count: 25,
      seedPrefix: "detail",
      idempotencyKey: "detail",
      strategy: {},
    });
    await app.executeSimulationRun({
      actorSessionToken: sessionToken,
      runId: created.id,
      now: simulationAdmissionNow,
    });

    const history = await handle({ method: "GET", path: "/simulations", sessionToken });
    expect(history).toMatchObject({
      status: 200,
      body: { simulations: [expect.objectContaining({ id: created.id, status: "completed" })] },
    });
    expect(JSON.stringify(history.body)).not.toContain("forcedSales");
    const detail = await handle({
      method: "GET",
      path: `/simulations/${created.id}`,
      sessionToken,
    });
    expect(detail).toMatchObject({
      status: 200,
      body: { simulation: { id: created.id, result: { runCount: 25 } } },
    });
  });
});
