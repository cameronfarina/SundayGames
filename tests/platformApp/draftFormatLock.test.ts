import { describe, it, InMemoryPlatformStore, PlatformAppError, asSnakeSeason, buildCurrentMockdLeagueSeason, createPlatformApp, expect, leagueConfig, mockRunner, now, ownerOrder, signUpAndLogin } from "./support/index.js";

const seasonWithStatus = (leagueName: string, setupStatus: "draft" | "published") =>
  buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { leagueName, setupStatus });

describe("platform app service", () => {
  it("locks the draft format once a league season is published", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11-format@example.com", "owner11 password", now);
    const season = seasonWithStatus("League 100001", "published");
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected fixture team.");

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
      ],
      now,
    });

    await expect(app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season: asSnakeSeason(season),
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
      ],
      now,
    })).rejects.toThrow(new PlatformAppError(
      "draft_format_locked",
      "Draft format cannot change after the league is published. Create a new season to switch formats.",
    ));

    const stored = await app.getLeagueSeason({ actorSessionToken: owner11.sessionToken, seasonId: season.id });
    expect(stored.settings.draftFormat ?? "auction").toBe("auction");
  });

  it("still allows a draft format change while the season is a draft", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11-draft@example.com", "owner11 password", now);
    const season = seasonWithStatus("League 100002", "draft");
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected fixture team.");

    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
      ],
      now,
    });

    const switched = await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season: asSnakeSeason(season),
      memberships: [
        { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
      ],
      now,
    });

    expect(switched.settings.draftFormat).toBe("snake");
  });
});
