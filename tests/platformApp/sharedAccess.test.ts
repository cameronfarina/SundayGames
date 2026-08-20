import { describe, it, InMemoryPlatformStore, JobError, PlatformAppError, buildCurrentMockdLeagueSeason, createPlatformApp, expect, leagueConfig, mockRunner, now, ownerOrder, signUpAndLogin } from "./support/index.js";

describe("platform app service", () => {
  it("registers a league season, gates shared access by membership, and keeps prep private", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password!", now);
    const owner04 = await signUpAndLogin(app, "owner04@example.com", "owner04 password!", now);
    const outsider = await signUpAndLogin(app, "outsider@example.com", "outsider password1!", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    const registeredSeason = await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: owner04.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
    });

    expect(registeredSeason).toEqual(season);
    expect(registeredSeason).not.toBe(season);
    expect(await app.getLeagueSeason({ actorSessionToken: owner11.sessionToken, seasonId: season.id })).toEqual(season);
    await expect(
      app.getLeagueSeason({ actorSessionToken: outsider.sessionToken, seasonId: season.id }),
    ).rejects.toThrow(new PlatformAppError(
      "membership_required",
      "Join this league before viewing shared league data.",
    ));

    const simulation = await app.createSimulationRun({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 25,
      seedPrefix: "owner11-puka-plan",
      idempotencyKey: "owner11-puka-plan",
      strategy: {
        hardLocks: [
          { playerName: "Puka Nacua", price: 62, auctionOwner: "Owner11" },
        ],
      },
      now,
    });
    const simulationJob = await app.enqueueSimulationRunExecutionJob({
      actorSessionToken: owner11.sessionToken,
      runId: simulation.id,
      idempotencyKey: "job:owner11-puka-plan",
      now,
    });

    expect(simulationJob).toMatchObject({
      userId: owner11.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      kind: "simulation",
      status: "queued",
    });
    await expect(app.listJobs({ actorSessionToken: owner11.sessionToken })).resolves.toMatchObject({
      jobs: [expect.objectContaining({ id: simulationJob.id, kind: "simulation" })],
      nextCursor: undefined,
    });
    await expect(app.listJobs({ actorSessionToken: owner04.sessionToken })).resolves.toEqual({
      jobs: [],
      nextCursor: undefined,
    });
    await expect(app.cancelJob({
      actorSessionToken: owner04.sessionToken,
      jobId: simulationJob.id,
      now: new Date(now.getTime() + 500),
    })).rejects.toThrow(new PlatformAppError("private_resource", "This job belongs to another user."));
    await expect(app.cancelJob({
      actorSessionToken: owner11.sessionToken,
      jobId: simulationJob.id,
      now: new Date(now.getTime() + 750),
    })).resolves.toMatchObject({
      id: simulationJob.id,
      status: "canceled",
      cancellationRequestedAt: new Date(now.getTime() + 750),
      finishedAt: new Date(now.getTime() + 750),
    });
    await expect(app.getSimulationRun({
      actorSessionToken: owner11.sessionToken,
      runId: simulation.id,
    })).resolves.toMatchObject({
      id: simulation.id,
      status: "canceled",
      result: undefined,
    });
    const rerunJob = await app.rerunJob({
      actorSessionToken: owner11.sessionToken,
      jobId: simulationJob.id,
      idempotencyKey: "rerun-owner11-puka-plan",
      now: new Date(now.getTime() + 800),
    });
    await expect(app.rerunJob({
      actorSessionToken: owner11.sessionToken,
      jobId: simulationJob.id,
      idempotencyKey: "different-active-key",
      now: new Date(now.getTime() + 850),
    })).rejects.toThrow(new JobError(
      "job_already_active",
      "A rerun is already queued or running for this simulation.",
    ));

    expect(rerunJob).toMatchObject({
      id: expect.stringMatching(/^job_/),
      status: "queued",
      kind: "simulation",
      inputJson: simulationJob.inputJson,
      idempotencyKey: `simulation-rerun:${simulation.id}`,
    });
    expect(rerunJob.id).not.toBe(simulationJob.id);
    await expect(app.getSimulationRun({
      actorSessionToken: owner11.sessionToken,
      runId: simulation.id,
    })).resolves.toMatchObject({
      id: simulation.id,
      status: "requested",
      result: undefined,
    });
    const completedRerunSimulation = await app.executeSimulationRun({
      actorSessionToken: owner11.sessionToken,
      runId: simulation.id,
      now: new Date(now.getTime() + 860),
    });
    await app.cancelJob({
      actorSessionToken: owner11.sessionToken,
      jobId: rerunJob.id,
      now: new Date(now.getTime() + 865),
    });
    const rerunAfterCompletion = await app.rerunJob({
      actorSessionToken: owner11.sessionToken,
      jobId: simulationJob.id,
      idempotencyKey: "rerun-owner11-puka-plan",
      now: new Date(now.getTime() + 870),
    });
    expect(completedRerunSimulation.status).toBe("completed");
    expect(rerunAfterCompletion.id).toBe(rerunJob.id);
    await expect(app.getSimulationRun({
      actorSessionToken: owner11.sessionToken,
      runId: simulation.id,
    })).resolves.toMatchObject({
      id: simulation.id,
      status: "requested",
      result: undefined,
    });
    await app.executeSimulationRun({
      actorSessionToken: owner11.sessionToken,
      runId: simulation.id,
      now: new Date(now.getTime() + 872),
    });
    await expect(app.rerunJob({
      actorSessionToken: owner04.sessionToken,
      jobId: simulationJob.id,
      idempotencyKey: "owner04-rerun",
      now: new Date(now.getTime() + 875),
    })).rejects.toThrow(new PlatformAppError("private_resource", "This job belongs to another user."));

    const executableSimulation = await app.createSimulationRun({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 25,
      seedPrefix: "owner11-puka-plan-direct",
      idempotencyKey: "owner11-puka-plan-direct",
      strategy: {
        hardLocks: [
          { playerName: "Puka Nacua", price: 62, auctionOwner: "Owner11" },
        ],
      },
      now: new Date(now.getTime() + 800),
    });
    const completed = await app.executeSimulationRun({
      actorSessionToken: owner11.sessionToken,
      runId: executableSimulation.id,
      now: new Date(now.getTime() + 1_000),
    });

    expect(completed.result).toMatchObject({
      runCount: 25,
      forcedSales: [{ owner: "Owner11", player: "Puka Nacua", price: 62 }],
    });
    expect((await app.listSimulationRuns({ actorSessionToken: owner11.sessionToken })).map(run => run.status)).toEqual([
      "completed",
      "completed",
    ]);
    await expect(app.listSimulationRuns({ actorSessionToken: owner04.sessionToken })).resolves.toEqual([]);
    await expect(
      app.getSimulationRun({ actorSessionToken: owner04.sessionToken, runId: executableSimulation.id }),
    ).rejects.toThrow(new PlatformAppError("private_resource", "This prep artifact belongs to another user."));
  });
});
