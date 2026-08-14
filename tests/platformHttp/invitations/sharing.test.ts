import { InMemoryPlatformInvitationRepository, InMemoryPlatformStore, buildCurrentMockdLeagueSeason, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, expectBodyRecord, expectString, it, leagueConfig, mockRunner, now, ownerOrder } from "../support/index.js";
import type { PlatformLeagueMembership } from "../support/index.js";

describe("platform HTTP contract", () => {
it("shares one league invitation and lets each account claim an available team", async () => {
    const store = new InMemoryPlatformStore();
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const invitationRepository = new InMemoryPlatformInvitationRepository();
    const commissioner = await createLoggedInAccount(
      createPlatformHttpHandler(app, { allowPublicSignup: true }),
      "commissioner@example.com",
    );
    const owner04 = await createLoggedInAccount(
      createPlatformHttpHandler(app, { allowPublicSignup: true }),
      "owner04@example.com",
    );
    const owner02 = await createLoggedInAccount(
      createPlatformHttpHandler(app, { allowPublicSignup: true }),
      "owner02@example.com",
    );
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Sunday Games",
      setupStatus: "published",
    });
    const commissionerTeam = season.teams[0];
    const sethTeam = season.teams[1];
    const hoodyTeam = season.teams[2];
    if (commissionerTeam === undefined || sethTeam === undefined || hoodyTeam === undefined) {
      throw new Error("Expected at least three teams.");
    }
    let memberships: PlatformLeagueMembership[] = [{
      userId: commissioner.account.id,
      leagueId: season.leagueId,
      role: "owner",
      ownerId: commissionerTeam.ownerId,
      teamId: commissionerTeam.id,
    }];
    await app.registerLeagueSeason({
      actorSessionToken: commissioner.sessionToken,
      season,
      memberships,
      now,
    });
    const handle = createPlatformHttpHandler(app, {
      invitationRepository,
      leagueSetupRepository: store,
      allowPublicSignup: true,
      applyAcceptedMembership: result => {
        memberships = [
          ...memberships.filter(candidate => candidate.userId !== result.membership.userId),
          result.membership,
        ];
        store.registerLeagueSeason({
          season,
          memberships,
          createdByUserId: result.invitation.id,
          now,
        });
      },
    });

    const issued = await handle({
      method: "POST",
      path: "/invitations",
      sessionToken: commissioner.sessionToken,
      now,
      body: { seasonId: season.id },
    });
    expect(issued).toMatchObject({
      status: 201,
      body: {
        invitation: {
          kind: "league",
          status: "pending",
          acceptPath: expect.stringContaining("/invite?token="),
        },
      },
    });
    const invitation = expectBodyRecord(expectBodyRecord(issued.body).invitation);
    const token = new URL(expectString(invitation.acceptPath), "http://mockd.local")
      .searchParams.get("token");
    if (token === null) throw new Error("Expected shared league token.");

    await expect(handle({
      method: "GET",
      path: `/invitations/details?token=${encodeURIComponent(token)}`,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        league: { name: "Sunday Games", seasonYear: season.seasonYear },
        teams: expect.arrayContaining([
          expect.objectContaining({ id: commissionerTeam.id, status: "claimed" }),
          expect.objectContaining({ id: sethTeam.id, status: "available" }),
          expect.objectContaining({ id: hoodyTeam.id, status: "available" }),
        ]),
      },
    });

    await expect(handle({
      method: "POST",
      path: "/invitations/claim",
      sessionToken: owner04.sessionToken,
      now,
      body: { token, teamId: sethTeam.id },
    })).resolves.toMatchObject({
      status: 200,
      body: { membership: { userId: owner04.account.id, teamId: sethTeam.id } },
    });
    await expect(handle({
      method: "POST",
      path: "/invitations/claim",
      sessionToken: owner04.sessionToken,
      now: new Date(now.getTime() + 31 * 24 * 60 * 60 * 1_000),
      body: { token, teamId: sethTeam.id },
    })).resolves.toMatchObject({
      status: 410,
      body: { error: { code: "invitation_expired" } },
    });
    await expect(handle({
      method: "POST",
      path: "/invitations/claim",
      sessionToken: owner02.sessionToken,
      now,
      body: { token, teamId: sethTeam.id },
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "team_already_claimed" } },
    });
    expect(await store.findMembership(owner02.account.id, season.leagueId)).toBeNull();
    await expect(handle({
      method: "POST",
      path: "/invitations/claim",
      sessionToken: owner02.sessionToken,
      now,
      body: { token, teamId: hoodyTeam.id },
    })).resolves.toMatchObject({
      status: 200,
      body: { membership: { userId: owner02.account.id, teamId: hoodyTeam.id } },
    });
    expect(await invitationRepository.findById(expectString(invitation.id)))
      .toMatchObject({ kind: "league", status: "pending" });
  });
});
