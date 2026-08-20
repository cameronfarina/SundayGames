import { describe, it, InMemoryPlatformStore, buildCurrentMockdLeagueSeason, createPlatformApp, expect, leagueConfig, mockRunner, now, ownerOrder, playerCatalog, signUpAndLogin } from "./support/index.js";

describe("platform app service", () => {
  it("returns copies of shared league and live room state", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password!", now);
    const owner04 = await signUpAndLogin(app, "owner04@example.com", "owner04 password!", now);
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
    registeredSeason.setupStatus = "draft";
    season.setupStatus = "draft";

    expect((await app.getLeagueSeason({ actorSessionToken: owner04.sessionToken, seasonId: season.id })).setupStatus)
      .toBe("published");

    const room = await app.createLiveDraftRoom({
      actorSessionToken: owner11.sessionToken,
      seasonId: season.id,
      roomId: "room_copy_test",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      now,
    });
    room.status = "ended";

    const freshRoom = await app.getLiveDraftRoom({ actorSessionToken: owner04.sessionToken, roomId: room.roomId });
    expect(freshRoom).not.toBe(room);
    expect(freshRoom.status).toBe("setup");
  });
});
