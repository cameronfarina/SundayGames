import { describe, it, InMemoryPlatformStore, PlatformAppError, buildCurrentMockdLeagueSeason, createPlatformApp, expect, leagueConfig, mockRunner, now, ownerOrder, playerCatalog, signUpAndLogin } from "./support/index.js";

describe("platform app service", () => {
  it("lets league members claim one current team without taking another user's team", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password!", now);
    const owner04 = await signUpAndLogin(app, "owner04@example.com", "owner04 password!", now);
    const sam = await signUpAndLogin(app, "sam@example.com", "sam secure password1!", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    const samTeam = season.teams.find(team => team.ownerDisplayName === "Owner12");
    if (camTeam === undefined || sethTeam === undefined || samTeam === undefined) {
      throw new Error("Expected fixture teams.");
    }

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: owner04.account.id, leagueId: season.leagueId, role: "member" },
        { userId: sam.account.id, leagueId: season.leagueId, role: "member" },
      ],
    });

    await expect(app.claimLeagueSeasonTeam({
      actorSessionToken: owner04.sessionToken,
      seasonId: season.id,
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
      now,
    })).resolves.toMatchObject({
      userId: owner04.account.id,
      leagueId: season.leagueId,
      role: "member",
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
    });
    await expect(app.claimLeagueSeasonTeam({
      actorSessionToken: sam.sessionToken,
      seasonId: season.id,
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
      now,
    })).rejects.toThrow(new PlatformAppError(
      "team_already_claimed",
      "That team is already claimed.",
    ));

    await expect(app.claimLeagueSeasonTeam({
      actorSessionToken: owner04.sessionToken,
      seasonId: season.id,
      ownerId: samTeam.ownerId,
      teamId: samTeam.id,
      now: new Date(now.getTime() + 1_000),
    })).resolves.toMatchObject({
      userId: owner04.account.id,
      ownerId: samTeam.ownerId,
      teamId: samTeam.id,
    });
    await expect(app.claimLeagueSeasonTeam({
      actorSessionToken: sam.sessionToken,
      seasonId: season.id,
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
      now: new Date(now.getTime() + 2_000),
    })).resolves.toMatchObject({
      userId: sam.account.id,
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
    });
  });

  it("locks an assigned team claim after a live draft has started", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password!", now);
    const owner04 = await signUpAndLogin(app, "owner04@example.com", "owner04 password!", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    const samTeam = season.teams.find(team => team.ownerDisplayName === "Owner12");
    if (camTeam === undefined || sethTeam === undefined || samTeam === undefined) {
      throw new Error("Expected fixture teams.");
    }

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: owner04.account.id, leagueId: season.leagueId, role: "member" },
      ],
    });
    const room = await app.createLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      roomId: "room_claim_lock",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      now,
    });
    await app.startLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      roomId: room.roomId,
      expectedRevision: room.revision,
      idempotencyKey: "start:claim-lock",
      now: new Date(now.getTime() + 1_000),
    });

    await expect(app.claimLeagueSeasonTeam({
      actorSessionToken: owner04.sessionToken,
      seasonId: season.id,
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
      now: new Date(now.getTime() + 2_000),
    })).resolves.toMatchObject({ teamId: sethTeam.id, ownerId: sethTeam.ownerId });
    await expect(app.claimLeagueSeasonTeam({
      actorSessionToken: owner04.sessionToken,
      seasonId: season.id,
      ownerId: samTeam.ownerId,
      teamId: samTeam.id,
      now: new Date(now.getTime() + 3_000),
    })).rejects.toThrow(new PlatformAppError(
      "team_claim_locked",
      "Your team claim is locked because this league's live draft has started.",
    ));
  });
});
