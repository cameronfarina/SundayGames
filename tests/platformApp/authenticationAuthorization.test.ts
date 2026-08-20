import { describe, it, InMemoryPlatformStore, PlatformAppError, buildCurrentMockdLeagueSeason, createPlatformApp, expect, leagueConfig, mockRunner, now, ownerOrder, signUpAndLogin } from "./support/index.js";

describe("platform app service", () => {
  it("changes the signed-in account password and invalidates all active sessions", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const firstLogin = await signUpAndLogin(app, "password@example.com", "current secure password1!", now);
    const secondLogin = await app.login({
      email: firstLogin.account.email,
      password: "current secure password1!",
      now: new Date(now.getTime() + 1),
    });
    if (secondLogin === null) throw new Error("Expected second login.");
    const changedAt = new Date(now.getTime() + 2);

    await expect(app.changePassword({
      actorSessionToken: firstLogin.sessionToken,
      currentPassword: "current secure password1!",
      newPassword: "replacement secure password1!",
      newPasswordConfirmation: "replacement secure password1!",
      now: changedAt,
    })).resolves.toEqual({
      account: { ...firstLogin.account, updatedAt: changedAt },
      revokedSessionCount: 2,
    });
    await expect(app.findAccountBySessionToken(firstLogin.sessionToken, new Date(now.getTime() + 3))).resolves.toBeNull();
    await expect(app.findAccountBySessionToken(secondLogin.sessionToken, new Date(now.getTime() + 3))).resolves.toBeNull();
  });

  it("requires an owner or admin actor when registering league season data", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const owner11 = await signUpAndLogin(app, "owner11@example.com", "owner11 password!", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected fixture team.");

    await expect(app.registerLeagueSeason({
        actorSessionToken: owner11.sessionToken,
        season,
        memberships: [
          {
            userId: owner11.account.id,
            leagueId: season.leagueId,
            role: "member",
            ownerId: camTeam.ownerId,
            teamId: camTeam.id,
          },
        ],
      })).rejects.toThrow(new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    ));
  });
});
