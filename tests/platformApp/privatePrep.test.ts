import { describe, it, InMemoryPlatformStore, PlatformAppError, buildCurrentMockdLeagueSeason, createPlatformApp, expect, leagueConfig, mockRunner, now, ownerOrder, signUpAndLogin } from "./support/index.js";

describe("platform app service", () => {
  it("rechecks current team claims before reading or mutating private prep", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password!", now);
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
      count: 5,
      seedPrefix: "old-claim",
      idempotencyKey: "old-claim",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Owner11" }] },
      now,
    });
    const mockSession = await app.createMockDraftSession({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      draftMode: { format: "auction", mockCount: 5 },
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

    await expect(app.listSimulationRuns({ actorSessionToken: owner11.sessionToken })).resolves.toEqual([]);
    await expect(
      app.getSimulationRun({ actorSessionToken: owner11.sessionToken, runId: simulation.id }),
    ).rejects.toThrow(new PlatformAppError("private_team_required", "Private prep can only use your claimed team."));
    await expect(
      app.appendMockDraftCommand({
        actorSessionToken: owner11.sessionToken,
        sessionId: mockSession.id,
        expectedRevision: 1,
        expectedCommandCount: 0,
        commandId: "cmd_after_claim_change",
        command: "draft puka for 62",
        now: new Date(now.getTime() + 1_000),
      }),
    ).rejects.toThrow(new PlatformAppError("private_team_required", "Private prep can only use your claimed team."));
  });
});
