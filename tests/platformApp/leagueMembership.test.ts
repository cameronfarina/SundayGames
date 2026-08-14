import { describe, it, InMemoryPlatformStore, PlatformAppError, buildCurrentMockdLeagueSeason, createPlatformApp, expect, leagueConfig, mockRunner, now, ownerOrder, signUpAndLogin } from "./support/index.js";

describe("platform app service", () => {
  it("blocks outsider setup overwrites and replaces omitted league memberships", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password", now);
    const owner04 = await signUpAndLogin(app, "owner04@example.com", "owner04 password", now);
    const outsider = await signUpAndLogin(app, "outsider@example.com", "outsider password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    const beatonTeam = season.teams.find(team => team.ownerDisplayName === "Owner01");
    if (camTeam === undefined || sethTeam === undefined || beatonTeam === undefined) {
      throw new Error("Expected fixture teams.");
    }

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: owner04.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
    });

    await expect(app.registerLeagueSeason({
        actorSessionToken: outsider.sessionToken,
        season,
        memberships: [
          {
            userId: outsider.account.id,
            leagueId: season.leagueId,
            role: "owner",
            ownerId: beatonTeam.ownerId,
            teamId: beatonTeam.id,
          },
        ],
      })).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));

    expect(await app.getLeagueSeason({ actorSessionToken: owner04.sessionToken, seasonId: season.id })).toEqual(season);

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
      ],
    });

    await expect(
      app.getLeagueSeason({ actorSessionToken: owner04.sessionToken, seasonId: season.id }),
    ).rejects.toThrow(new PlatformAppError(
      "membership_required",
      "Join this league before viewing shared league data.",
    ));
  });

  it("blocks outsider registration for a new season in an existing league", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password", now);
    const outsider = await signUpAndLogin(app, "outsider@example.com", "outsider password", now);
    const season2026 = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
      seasonYear: 2026,
    });
    const season2027 = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
      seasonYear: 2027,
    });
    const camTeam = season2026.teams.find(team => team.ownerDisplayName === "Owner11");
    const outsiderTeam = season2027.teams.find(team => team.ownerDisplayName === "Owner01");
    if (camTeam === undefined || outsiderTeam === undefined) throw new Error("Expected fixture teams.");

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season: season2026,
      memberships: [
        {
          userId: owner11.account.id,
          leagueId: season2026.leagueId,
          role: "owner",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        },
      ],
    });

    await expect(app.registerLeagueSeason({
        actorSessionToken: outsider.sessionToken,
        season: season2027,
        memberships: [
          {
            userId: outsider.account.id,
            leagueId: season2027.leagueId,
            role: "owner",
            ownerId: outsiderTeam.ownerId,
            teamId: outsiderTeam.id,
          },
        ],
      })).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));

    expect(await app.getLeagueSeason({ actorSessionToken: owner11.sessionToken, seasonId: season2026.id })).toEqual(season2026);
  });
});
