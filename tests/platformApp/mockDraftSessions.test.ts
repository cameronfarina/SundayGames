import { describe, it, InMemoryPlatformStore, PlatformAppError, buildCurrentMockdLeagueSeason, createPlatformApp, expect, leagueConfig, mockRunner, now, ownerOrder, signUpAndLogin } from "./support/index.js";

describe("platform app service", () => {
  it("runs mock draft sessions through revision and command-count guards", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected Owner11 fixture team.");

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
      ],
    });

    const session = await app.createMockDraftSession({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      draftMode: { format: "auction", mockCount: 5, label: "Practice auction" },
      now,
    });
    const appended = await app.appendMockDraftCommand({
      actorSessionToken: owner11.sessionToken,
      sessionId: session.id,
      expectedRevision: 1,
      expectedCommandCount: 0,
      commandId: "cmd_puka",
      command: "draft puka for 62",
      idempotencyKey: "mock:puka:62",
      now: new Date(now.getTime() + 1_000),
    });

    expect(await app.listMockDraftSessions({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      now: new Date(now.getTime() + 1_000),
    })).toEqual([appended]);

    const reset = await app.resetMockDraftSession({
      actorSessionToken: owner11.sessionToken,
      sessionId: session.id,
      expectedRevision: 1,
      now: new Date(now.getTime() + 2_000),
    });

    expect(reset.revision).toBe(2);
    expect(reset.commandLog).toEqual([]);
    await expect(
      app.appendMockDraftCommand({
        actorSessionToken: owner11.sessionToken,
        sessionId: session.id,
        expectedRevision: 1,
        expectedCommandCount: 1,
        commandId: "cmd_stale",
        command: "draft ladd for 21",
        now: new Date(now.getTime() + 3_000),
      }),
    ).rejects.toThrow();
  });

  it("rejects mock draft result references to another user's private simulation", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password", now);
    const owner04 = await signUpAndLogin(app, "owner04@example.com", "owner04 password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: owner04.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
    });
    const sethSimulation = await app.createSimulationRun({
      actorSessionToken: owner04.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
      count: 5,
      seedPrefix: "owner04-private-run",
      idempotencyKey: "owner04-private-run",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Owner11" }] },
      now,
    });
    await app.executeSimulationRun({
      actorSessionToken: owner04.sessionToken,
      runId: sethSimulation.id,
      now: new Date(now.getTime() + 500),
    });
    const camSession = await app.createMockDraftSession({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      draftMode: { format: "auction", mockCount: 5 },
      now,
    });

    await expect(app.appendMockDraftCommand({
      actorSessionToken: owner11.sessionToken,
      sessionId: camSession.id,
      expectedRevision: 1,
      expectedCommandCount: 0,
      commandId: "cmd_leak",
      command: "show owner04 result",
      idempotencyKey: "mock:leak",
      latestResultRef: { kind: "simulation-result", id: sethSimulation.id },
      now: new Date(now.getTime() + 1_000),
    })).rejects.toThrow(new PlatformAppError(
      "private_resource",
      "This prep artifact belongs to another user.",
    ));

    const [storedSession] = await app.listMockDraftSessions({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      now: new Date(now.getTime() + 1_000),
    });
    expect(storedSession).toMatchObject({
      id: camSession.id,
      latestResultRef: undefined,
      commandLog: [],
    });
  });
});
