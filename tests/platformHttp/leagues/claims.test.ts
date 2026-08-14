import { InMemoryPlatformStore, buildCurrentMockdLeagueSeason, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, expectBodyRecord, expectRecordArray, expectString, it, leagueConfig, mockRunner, ownerOrder } from "../support/index.js";

describe("platform HTTP contract", () => {
it("claims a league season team for the authenticated account", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const owner11 = await createLoggedInAccount(handle, "owner11@example.com");
    const owner04 = await createLoggedInAccount(handle, "owner04@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: owner11.sessionToken,
      body: {
        season,
        memberships: [
          { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
          { userId: owner04.account.id, leagueId: season.leagueId, role: "member" },
        ],
      },
    });

    await expect(handle({
      method: "GET",
      path: `/seasons/${season.id}`,
      sessionToken: owner04.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        claimableTeams: expect.arrayContaining([expect.objectContaining({ id: sethTeam.id })]),
      },
    });
    const beforeClaim = await handle({
      method: "GET",
      path: `/seasons/${season.id}`,
      sessionToken: owner04.sessionToken,
    });
    const beforeClaimTeams = expectRecordArray(expectBodyRecord(beforeClaim.body).claimableTeams);
    expect(beforeClaimTeams.map(team => expectString(team.id)))
      .not.toContain(camTeam.id);

    const claim = await handle({
      method: "POST",
      path: `/seasons/${season.id}/team-claims`,
      sessionToken: owner04.sessionToken,
      body: {
        ownerId: sethTeam.ownerId,
        teamId: sethTeam.id,
      },
    });

    expect(claim).toEqual({
      status: 200,
      body: {
        membership: {
          userId: owner04.account.id,
          leagueId: season.leagueId,
          role: "member",
          ownerId: sethTeam.ownerId,
          teamId: sethTeam.id,
        },
      },
    });
    const afterClaim = await handle({
      method: "GET",
      path: `/seasons/${season.id}`,
      sessionToken: owner04.sessionToken,
    });
    const afterClaimTeams = expectRecordArray(expectBodyRecord(afterClaim.body).claimableTeams);
    expect(afterClaimTeams.map(team => expectString(team.id)))
      .not.toContain(sethTeam.id);
  });
});
