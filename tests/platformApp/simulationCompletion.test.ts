import { describe, it, InMemoryPlatformStore, InMemorySimulationRepository, buildCurrentMockdLeagueSeason, createPlatformApp, expect, leagueConfig, mockRunner, now, ownerOrder, signUpAndLogin, type SimulationResult } from "./support/index.js";

describe("platform app service", () => {
  it("marks a synchronous season simulation failed when completion persistence throws", async () => {
    class FailingCompletionRepository extends InMemorySimulationRepository {
      override complete(_runId: string, _result: SimulationResult): never {
        throw new Error("completion unavailable");
      }
    }

    const simulationRepository = new FailingCompletionRepository();
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      simulationRepository,
      simulationRunner: mockRunner,
    });
    const owner11 = await signUpAndLogin(app, "failed-season-sim@example.com", "owner11 password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "published" });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected Owner11 fixture team.");
    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [{
        userId: owner11.account.id,
        leagueId: season.leagueId,
        role: "owner",
        ownerId: camTeam.ownerId,
        teamId: camTeam.id,
      }],
    });
    const run = await app.createSimulationRun({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 1,
      seedPrefix: "failed-completion",
      idempotencyKey: "failed-completion",
      strategy: {},
      now,
    });
    const result: SimulationResult = {
      runId: run.id,
      requestId: run.request.id,
      completedAt: now,
      runCount: 1,
      seedPrefix: run.request.seedPrefix,
      hardLockCount: 0,
      softTargetCount: 0,
      forcedSales: [],
      summary: { runCount: 1, scenarios: [], players: [], owners: [], ownerPlayerExposure: [] },
    };

    await expect(app.completeSeasonSimulationRun({
      actorSessionToken: owner11.sessionToken,
      runId: run.id,
      result,
      now,
    })).rejects.toThrow("completion unavailable");
    expect(simulationRepository.find(run.id).status).toBe("failed");
  });
});
