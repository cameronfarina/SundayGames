import { InMemoryPlatformInvitationRepository, InMemoryPlatformStore, buildCurrentMockdLeagueSeason, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, issuePlatformInvitation, it, leagueConfig, mockRunner, now, ownerOrder } from "../support/index.js";

describe("platform HTTP contract", () => {
it("rejects invitations for claimed teams and existing league members while preserving pending conflicts", async () => {
    const store = new InMemoryPlatformStore();
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const invitationRepository = new InMemoryPlatformInvitationRepository();
    const handle = createPlatformHttpHandler(app, {
      invitationRepository,
      allowPublicSignup: true,
    });
    const commissioner = await createLoggedInAccount(handle, "commissioner@example.com");
    const existingMember = await createLoggedInAccount(handle, "member@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Sunday Games",
      setupStatus: "published",
    });
    const claimedTeam = season.teams[0];
    const firstOpenTeam = season.teams[1];
    const secondOpenTeam = season.teams[2];
    if (claimedTeam === undefined || firstOpenTeam === undefined || secondOpenTeam === undefined) {
      throw new Error("Expected at least three team fixtures.");
    }
    await app.registerLeagueSeason({
      actorSessionToken: commissioner.sessionToken,
      season,
      memberships: [
        { userId: commissioner.account.id, leagueId: season.leagueId, role: "owner" },
        {
          userId: existingMember.account.id,
          leagueId: season.leagueId,
          role: "admin",
          ownerId: claimedTeam.ownerId,
          teamId: claimedTeam.id,
        },
      ],
      now,
    });

    await expect(handle({
      method: "POST",
      path: "/invitations",
      sessionToken: commissioner.sessionToken,
      now,
      body: {
        seasonId: season.id,
        teamId: claimedTeam.id,
        email: "new-manager@example.com",
      },
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "invitation_team_claimed" } },
    });
    await expect(handle({
      method: "POST",
      path: "/invitations",
      sessionToken: commissioner.sessionToken,
      now,
      body: {
        seasonId: season.id,
        teamId: firstOpenTeam.id,
        email: " MEMBER@example.com ",
      },
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "invitation_existing_member" } },
    });

    await expect(handle({
      method: "POST",
      path: "/invitations",
      sessionToken: commissioner.sessionToken,
      now,
      body: {
        seasonId: season.id,
        teamId: firstOpenTeam.id,
        email: "pending@example.com",
      },
    })).resolves.toMatchObject({ status: 201 });
    await expect(handle({
      method: "POST",
      path: "/invitations",
      sessionToken: commissioner.sessionToken,
      now,
      body: {
        seasonId: season.id,
        teamId: secondOpenTeam.id,
        email: "pending@example.com",
      },
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "invitation_email_conflict" } },
    });
    await expect(handle({
      method: "POST",
      path: "/invitations",
      sessionToken: commissioner.sessionToken,
      now,
      body: {
        seasonId: season.id,
        teamId: firstOpenTeam.id,
        email: "different@example.com",
      },
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "invitation_team_conflict" } },
    });

    await issuePlatformInvitation(invitationRepository, {
      leagueId: season.leagueId,
      seasonId: season.id,
      email: existingMember.account.email,
      role: "member",
      ownerId: firstOpenTeam.ownerId,
      teamId: firstOpenTeam.id,
      ownerDisplayName: firstOpenTeam.ownerDisplayName,
      teamDisplayName: firstOpenTeam.displayName,
      invitedByUserId: commissioner.account.id,
      now,
      expiresAt: new Date(now.getTime() + 86_400_000),
    }, {
      idFactory: () => "invite_existing_member_race",
      tokenFactory: () => "existing-member-race-token",
    });
    await expect(handle({
      method: "POST",
      path: "/invitations/accept",
      sessionToken: existingMember.sessionToken,
      now,
      body: { token: "existing-member-race-token" },
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "invitation_existing_member" } },
    });

    const invitedManager = await createLoggedInAccount(handle, "invited-manager@example.com");
    const claimingManager = await createLoggedInAccount(handle, "claiming-manager@example.com");
    await issuePlatformInvitation(invitationRepository, {
      leagueId: season.leagueId,
      seasonId: season.id,
      email: invitedManager.account.email,
      role: "member",
      ownerId: secondOpenTeam.ownerId,
      teamId: secondOpenTeam.id,
      ownerDisplayName: secondOpenTeam.ownerDisplayName,
      teamDisplayName: secondOpenTeam.displayName,
      invitedByUserId: commissioner.account.id,
      now,
      expiresAt: new Date(now.getTime() + 86_400_000),
    }, {
      idFactory: () => "invite_claimed_team_race",
      tokenFactory: () => "claimed-team-race-token",
    });
    await app.registerLeagueSeason({
      actorSessionToken: commissioner.sessionToken,
      season,
      memberships: [
        { userId: commissioner.account.id, leagueId: season.leagueId, role: "owner" },
        {
          userId: existingMember.account.id,
          leagueId: season.leagueId,
          role: "admin",
          ownerId: claimedTeam.ownerId,
          teamId: claimedTeam.id,
        },
        {
          userId: claimingManager.account.id,
          leagueId: season.leagueId,
          role: "member",
          ownerId: secondOpenTeam.ownerId,
          teamId: secondOpenTeam.id,
        },
      ],
      now,
    });
    await expect(handle({
      method: "POST",
      path: "/invitations/accept",
      sessionToken: invitedManager.sessionToken,
      now,
      body: { token: "claimed-team-race-token" },
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "invitation_team_claimed" } },
    });
  });
});
