import { describe, it, AsyncLeagueSetupRepository, InMemoryPlatformStore, PlatformAppError, buildCurrentMockdLeagueSeason, createPlatformApp, expect, leagueConfig, mockRunner, now, ownerOrder, signUpAndLogin } from "./support/index.js";

describe("platform app service", () => {
  it("uses an injected async league setup repository for season reads and registration", async () => {
    const leagueSetupRepository = new AsyncLeagueSetupRepository();
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      leagueSetupRepository,
      simulationRunner: mockRunner,
    });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password", now);
    const owner04 = await signUpAndLogin(app, "owner04@example.com", "owner04 password", now);
    const outsider = await signUpAndLogin(app, "outsider@example.com", "outsider password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const nextSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      seasonYear: season.seasonYear + 1,
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    const nextCamTeam = nextSeason.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined || sethTeam === undefined || nextCamTeam === undefined) {
      throw new Error("Expected fixture teams.");
    }

    await leagueSetupRepository.registerLeagueSeason({
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
        { userId: owner04.account.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
      ],
      createdByUserId: owner11.account.id,
      now,
    });

    expect(app.store.findLeagueSeason(season.id)).toBeNull();
    await expect(app.getLeagueSeason({ actorSessionToken: owner04.sessionToken, seasonId: season.id, now })).resolves.toEqual(season);
    await expect(
      app.registerLeagueSeason({
        actorSessionToken: outsider.sessionToken,
        season: nextSeason,
        memberships: [
          {
            userId: outsider.account.id,
            leagueId: nextSeason.leagueId,
            role: "owner",
            ownerId: nextCamTeam.ownerId,
            teamId: nextCamTeam.id,
          },
        ],
        now,
      }),
    ).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));

    const registeredNextSeason = await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season: nextSeason,
      memberships: [
        {
          userId: owner11.account.id,
          leagueId: nextSeason.leagueId,
          role: "owner",
          ownerId: nextCamTeam.ownerId,
          teamId: nextCamTeam.id,
        },
      ],
      now: new Date(now.getTime() + 1_000),
    });

    expect(registeredNextSeason).toEqual(nextSeason);
    expect(leagueSetupRepository.registerInputs.at(-1)).toMatchObject({
      season: nextSeason,
      createdByUserId: owner11.account.id,
    });
    await expect(app.getLeagueSeason({ actorSessionToken: owner11.sessionToken, seasonId: nextSeason.id, now })).resolves.toEqual(nextSeason);
  });
});
