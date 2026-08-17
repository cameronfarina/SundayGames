import { InMemoryPlatformInvitationRepository, InMemoryPlatformStore, buildCurrentMockdLeagueSeason, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, expectBodyRecord, expectString, issuePlatformInvitation, it, leagueConfig, mockRunner, now, ownerOrder } from "../support/index.js";
import type { PlatformOnboardingRepository } from "../support/index.js";

describe("platform HTTP contract", () => {
it("connects onboarding and invitation lifecycle routes to league membership", async () => {
    const store = new InMemoryPlatformStore();
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const invitationRepository = new InMemoryPlatformInvitationRepository();
    const acceptedMemberships: unknown[] = [];
    const onboardingRepository: PlatformOnboardingRepository = {
      listForUser: async (userId: string) => userId === "missing" ? [] : [{
        leagueId: "league-100001",
        leagueName: "Sunday Games",
        leagueSlug: "sunday-games",
        seasonId: "league-100001-season-2026",
        seasonYear: 2026,
        membership: { role: "owner" },
        canManageLeague: true,
        readiness: {
          leagueSetup: "ready",
          teamClaim: "needs_attention",
          liveDraft: "needs_attention",
        },
        liveDraft: null,
      }],
    };
    const handle = createPlatformHttpHandler(app, {
      invitationRepository,
      leagueSetupRepository: store,
      onboardingRepository,
      allowPublicSignup: true,
      applyAcceptedMembership: result => {
        acceptedMemberships.push(result.membership);
      },
    });
    const owner11 = await createLoggedInAccount(handle, "owner11@example.com");
    const owner04 = await createLoggedInAccount(handle, "owner04@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Sunday Games",
      setupStatus: "published",
    });
    await app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [{ userId: owner11.account.id, leagueId: season.leagueId, role: "owner" }],
      now,
    });
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    if (sethTeam === undefined) throw new Error("Expected Owner04 team fixture.");
    await issuePlatformInvitation(invitationRepository, {
      leagueId: season.leagueId,
      seasonId: season.id,
      email: owner04.account.email,
      role: "member",
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
      ownerDisplayName: sethTeam.ownerDisplayName,
      teamDisplayName: sethTeam.displayName,
      invitedByUserId: owner11.account.id,
      now,
      expiresAt: new Date(now.getTime() + 86_400_000),
    }, {
      idFactory: () => "invite_seth",
      tokenFactory: () => "initial-token",
    });

    await expect(handle({
      method: "GET",
      path: "/onboarding",
      sessionToken: owner11.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: { account: { id: owner11.account.id }, leagues: [{ leagueName: "Sunday Games" }] },
    });
    await expect(handle({
      method: "GET",
      path: `/invitations?seasonId=${encodeURIComponent(season.id)}`,
      sessionToken: owner04.sessionToken,
    })).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "membership_required" } },
    });
    await expect(handle({
      method: "GET",
      path: `/invitations?seasonId=${encodeURIComponent(season.id)}`,
      sessionToken: owner11.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: { invitations: [{ id: "invite_seth", status: "pending" }] },
    });

    const beatonTeam = season.teams.find(team => team.ownerDisplayName === "Owner01");
    if (beatonTeam === undefined) throw new Error("Expected Owner01 team fixture.");
    const issued = await handle({
      method: "POST",
      path: "/invitations",
      sessionToken: owner11.sessionToken,
      now,
      body: {
        seasonId: season.id,
        teamId: beatonTeam.id,
        email: " Owner01@Example.com ",
      },
    });
    expect(issued).toMatchObject({
      status: 201,
      body: {
        invitation: {
          email: "owner01@example.com",
          role: "member",
          teamDisplayName: beatonTeam.displayName,
          acceptPath: expect.stringContaining("/invite?token="),
        },
      },
    });
    await expect(handle({
      method: "POST",
      path: "/invitations",
      sessionToken: owner04.sessionToken,
      now,
      body: {
        seasonId: season.id,
        teamId: beatonTeam.id,
        email: "other@example.com",
      },
    })).resolves.toMatchObject({ status: 403 });
    await expect(handle({
      method: "POST",
      path: "/invitations",
      sessionToken: owner11.sessionToken,
      now,
      body: {
        seasonId: season.id,
        teamId: "missing-team",
        email: "other@example.com",
      },
    })).resolves.toMatchObject({
      status: 404,
      body: { error: { code: "team_not_found" } },
    });

    const reissued = await handle({
      method: "POST",
      path: "/invitations/invite_seth/reissue",
      sessionToken: owner11.sessionToken,
      now,
    });
    expect(reissued).toMatchObject({
      status: 200,
      body: { invitation: { status: "pending", acceptPath: expect.stringContaining("/invite?token=") } },
    });
    const reissuedBody = expectBodyRecord(reissued.body);
    const reissuedInvitation = expectBodyRecord(reissuedBody.invitation);
    const token = new URL(expectString(reissuedInvitation.acceptPath), "http://mockd.local")
      .searchParams.get("token");
    if (token === null) throw new Error("Expected reissued invitation token.");

    await expect(handle({
      method: "GET",
      path: `/invitations/details?token=${encodeURIComponent(token)}`,
      now,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        invitation: { kind: "team", teamId: sethTeam.id },
        teams: [{ id: sethTeam.id, status: "available" }],
      },
    });
    await expect(handle({
      method: "POST",
      path: "/invitations/claim",
      sessionToken: owner04.sessionToken,
      body: { token, teamId: sethTeam.id },
      now,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        invitation: { status: "accepted" },
        membership: { userId: owner04.account.id, teamId: sethTeam.id },
      },
    });
    expect(acceptedMemberships).toEqual([
      expect.objectContaining({ userId: owner04.account.id, leagueId: season.leagueId }),
    ]);
  });
});
