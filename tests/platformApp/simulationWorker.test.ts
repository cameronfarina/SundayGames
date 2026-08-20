import { describe, it, InMemoryPlatformStore, PlatformAppError, buildCurrentMockdLeagueSeason, createPlatformApp, expect, leagueConfig, mockRunner, now, ownerOrder, signUpAndLogin } from "./support/index.js";

describe("platform app service", () => {
  it("lets a server worker execute an existing simulation while preserving private team ownership checks", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password!", now);
    const owner04 = await signUpAndLogin(app, "owner04@example.com", "owner04 password!", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const beatonTeam = season.teams.find(team => team.ownerDisplayName === "Owner01");
    if (camTeam === undefined || beatonTeam === undefined) throw new Error("Expected fixture teams.");

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
      ],
    });

    const simulation = await app.createSimulationRun({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 10,
      seedPrefix: "worker-plan",
      idempotencyKey: "worker-plan",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Owner11" }] },
      now,
    });

    const completed = await app.executeSimulationRunForWorker({
      runId: simulation.id,
      userId: owner11.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      now: new Date(now.getTime() + 1_000),
    });

    expect(completed.status).toBe("completed");
    expect(completed.result).toMatchObject({
      runCount: 10,
      forcedSales: [{ owner: "Owner11", player: "Puka Nacua", price: 62 }],
    });
    await expect(app.executeSimulationRunForWorker({
      runId: simulation.id,
      userId: owner04.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      now: new Date(now.getTime() + 1_500),
    })).rejects.toThrow(new PlatformAppError(
      "private_resource",
      "This prep artifact belongs to another user.",
    ));

    const blockedSimulation = await app.createSimulationRun({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 10,
      seedPrefix: "worker-plan-stale-claim",
      idempotencyKey: "worker-plan-stale-claim",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Owner11" }] },
      now,
    });

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        {
          userId: owner11.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: beatonTeam.ownerId,
          teamId: beatonTeam.id,
        },
      ],
    });

    await expect(app.executeSimulationRunForWorker({
      runId: blockedSimulation.id,
      userId: owner11.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      now: new Date(now.getTime() + 2_000),
    })).rejects.toThrow(new PlatformAppError(
      "private_team_required",
      "Private prep can only use your claimed team.",
    ));
  });
});
