import { describe, expect, it } from "vitest";
import {
  acceptPlatformInvitation,
  derivePlatformLeagueInvitationToken,
  hashPlatformInvitationToken,
  InMemoryPlatformInvitationRepository,
  issuePlatformInvitation,
  issuePlatformLeagueInvitation,
  joinPlatformLeagueInvitation,
  listPlatformInvitations,
  PlatformInvitationError,
  reissuePlatformInvitation,
  revokePlatformInvitation,
} from "../src/platform/platformInvitations.js";

const now = new Date("2026-08-10T12:00:00.000Z");
const expiresAt = new Date("2026-08-17T12:00:00.000Z");
const leagueTokenSecret = "test-invitation-secret-at-least-32-characters";

const invitationInput = {
  leagueId: "league_1",
  seasonId: "season_2026",
  email: "seth@example.com",
  role: "member" as const,
  ownerId: "seth",
  teamId: "team_seth",
  ownerDisplayName: "Seth",
  teamDisplayName: "Seth's Team",
  invitedByUserId: "acct_cam",
  now,
  expiresAt,
};

describe("platform invitations", () => {
  it("issues one reusable league invitation for multiple accounts", async () => {
    const repository = new InMemoryPlatformInvitationRepository();
    const issued = await issuePlatformLeagueInvitation(repository, {
      leagueId: "league_1",
      seasonId: "season_2026",
      invitedByUserId: "acct_cam",
      now,
      expiresAt,
    }, {
      idFactory: () => "invite_league_1",
      leagueTokenSecret,
    });
    const token = derivePlatformLeagueInvitationToken("invite_league_1", leagueTokenSecret);

    expect(issued).toMatchObject({
      id: "invite_league_1",
      kind: "league",
      status: "pending",
      acceptPath: `/invite?token=${token}`,
    });
    expect(issued).not.toHaveProperty("email");
    expect(issued).not.toHaveProperty("teamId");
    expect(token).not.toBe(issued.id);
    expect(await repository.findByTokenHash(hashPlatformInvitationToken(token))).toMatchObject({
      id: issued.id,
      tokenHash: hashPlatformInvitationToken(token),
    });

    const firstJoin = await joinPlatformLeagueInvitation(repository, {
      token,
      account: { id: "acct_seth", email: "seth@example.com" },
      now: new Date("2026-08-11T12:00:00.000Z"),
    });
    const secondJoin = await joinPlatformLeagueInvitation(repository, {
      token,
      account: { id: "acct_hoody", email: "hoody@example.com" },
      now: new Date("2026-08-11T12:01:00.000Z"),
    });

    expect(firstJoin.membership).toEqual({
      userId: "acct_seth",
      leagueId: "league_1",
      role: "member",
    });
    expect(secondJoin.membership).toEqual({
      userId: "acct_hoody",
      leagueId: "league_1",
      role: "member",
    });
    expect(await repository.findById("invite_league_1")).toMatchObject({ status: "pending" });
    expect(await listPlatformInvitations(repository, "season_2026", { leagueTokenSecret })).toEqual([
      expect.objectContaining({ acceptPath: `/invite?token=${token}` }),
    ]);
    expect(await listPlatformInvitations(repository, "season_2026", {
      leagueTokenSecret: "different-invitation-secret-at-least-32-characters",
    })).toEqual([expect.not.objectContaining({ acceptPath: expect.anything() })]);
  });

  it("returns the surviving shared link when commissioners create one concurrently", async () => {
    const repository = new InMemoryPlatformInvitationRepository();
    const input = {
      leagueId: "league_1",
      seasonId: "season_2026",
      invitedByUserId: "acct_cam",
      now,
      expiresAt,
    };

    const [first, second] = await Promise.all([
      issuePlatformLeagueInvitation(repository, input, {
        idFactory: () => "invite_league_1",
        leagueTokenSecret,
      }),
      issuePlatformLeagueInvitation(repository, input, {
        idFactory: () => "invite_league_2",
        leagueTokenSecret,
      }),
    ]);

    expect(second).toEqual(first);
    expect((await repository.listForSeason(input.seasonId)).filter(record =>
      record.kind === "league" && record.status === "pending"
    )).toHaveLength(1);
  });

  it("issues an actionable invitation while storing only a token hash", async () => {
    const repository = new InMemoryPlatformInvitationRepository();
    const issued = await issuePlatformInvitation(repository, invitationInput, {
      idFactory: () => "invite_1",
      tokenFactory: () => "raw invite token",
    });

    expect(issued).toMatchObject({
      id: "invite_1",
      status: "pending",
      email: "seth@example.com",
      acceptPath: "/invite?token=raw+invite+token",
      reissuePath: "/invitations/invite_1/reissue",
      revokePath: "/invitations/invite_1/revoke",
    });
    expect(issued).not.toHaveProperty("tokenHash");
    expect(await repository.findByTokenHash(hashPlatformInvitationToken("raw invite token"))).toMatchObject({
      id: "invite_1",
      tokenHash: hashPlatformInvitationToken("raw invite token"),
    });
  });

  it("accepts a matching invitation and returns durable membership identity", async () => {
    const repository = new InMemoryPlatformInvitationRepository();
    await issuePlatformInvitation(repository, invitationInput, {
      idFactory: () => "invite_1",
      tokenFactory: () => "raw invite token",
    });

    const accepted = await acceptPlatformInvitation(repository, {
      token: "raw invite token",
      account: { id: "acct_seth", email: "SETH@example.com" },
      now: new Date("2026-08-11T12:00:00.000Z"),
    });

    expect(accepted).toMatchObject({
      invitation: { id: "invite_1", status: "accepted" },
      membership: {
        userId: "acct_seth",
        leagueId: "league_1",
        role: "member",
        ownerId: "seth",
        teamId: "team_seth",
        inviteEmail: "seth@example.com",
      },
    });
  });

  it("rejects mismatched and expired invitations without changing status", async () => {
    const repository = new InMemoryPlatformInvitationRepository();
    await issuePlatformInvitation(repository, invitationInput, {
      idFactory: () => "invite_1",
      tokenFactory: () => "raw invite token",
    });

    let mismatchError: unknown;
    try {
      await acceptPlatformInvitation(repository, {
        token: "raw invite token",
        account: { id: "acct_other", email: "other@example.com" },
        now,
      });
    } catch (error) {
      mismatchError = error;
    }
    expect(mismatchError).toMatchObject({
      code: "invitation_email_mismatch",
      message: "This invitation cannot be accepted by the signed-in account.",
    });
    expect((mismatchError as Error).message).not.toContain(invitationInput.email);
    await expect(acceptPlatformInvitation(repository, {
      token: "raw invite token",
      account: { id: "acct_seth", email: "seth@example.com" },
      now: new Date("2026-08-18T12:00:00.000Z"),
    })).rejects.toThrow(new PlatformInvitationError(
      "invitation_expired",
      "This invitation has expired. Ask the commissioner for a new link.",
    ));
    expect((await repository.listForSeason("season_2026"))[0]?.status).toBe("pending");
  });

  it("reissues and revokes invitations through explicit lifecycle helpers", async () => {
    const repository = new InMemoryPlatformInvitationRepository();
    await issuePlatformInvitation(repository, invitationInput, {
      idFactory: () => "invite_1",
      tokenFactory: () => "first token",
    });

    const replacement = await reissuePlatformInvitation(repository, {
      invitationId: "invite_1",
      invitedByUserId: "acct_cam",
      now: new Date("2026-08-11T12:00:00.000Z"),
      expiresAt: new Date("2026-08-18T12:00:00.000Z"),
    }, {
      idFactory: () => "invite_2",
      tokenFactory: () => "replacement token",
    });

    expect(replacement).toMatchObject({
      id: "invite_2",
      status: "pending",
      acceptPath: "/invite?token=replacement+token",
    });
    expect(await repository.findById("invite_1")).toMatchObject({ status: "revoked" });

    const revoked = await revokePlatformInvitation(repository, "invite_2", now);
    expect(revoked).toMatchObject({ id: "invite_2", status: "revoked" });

    const listed = await listPlatformInvitations(repository, "season_2026");
    expect(listed).toHaveLength(2);
    expect(listed[0]).not.toHaveProperty("tokenHash");
    expect(listed[0]).not.toHaveProperty("acceptPath");
  });

  it("keeps one pending replacement when commissioners regenerate concurrently", async () => {
    const repository = new InMemoryPlatformInvitationRepository();
    await issuePlatformInvitation(repository, invitationInput, {
      idFactory: () => "invite_1",
      tokenFactory: () => "first token",
    });
    const replacementInput = {
      invitationId: "invite_1",
      invitedByUserId: "acct_cam",
      now: new Date("2026-08-11T12:00:00.000Z"),
      expiresAt: new Date("2026-08-18T12:00:00.000Z"),
    };

    const results = await Promise.allSettled([
      reissuePlatformInvitation(repository, replacementInput, {
        idFactory: () => "invite_2",
        tokenFactory: () => "second token",
      }),
      reissuePlatformInvitation(repository, replacementInput, {
        idFactory: () => "invite_3",
        tokenFactory: () => "third token",
      }),
    ]);

    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    expect((await repository.listForSeason("season_2026")).filter(record => record.status === "pending"))
      .toHaveLength(1);
  });

  it("returns the surviving shared link when commissioners regenerate concurrently", async () => {
    const repository = new InMemoryPlatformInvitationRepository();
    const issued = await issuePlatformLeagueInvitation(repository, {
      leagueId: "league_1",
      seasonId: "season_2026",
      invitedByUserId: "acct_cam",
      now,
      expiresAt,
    }, {
      idFactory: () => "invite_league_1",
      leagueTokenSecret,
    });
    const replacementInput = {
      invitationId: issued.id,
      invitedByUserId: "acct_cam",
      now: new Date("2026-08-11T12:00:00.000Z"),
      expiresAt: new Date("2026-09-11T12:00:00.000Z"),
    };

    const [first, second] = await Promise.all([
      reissuePlatformInvitation(repository, replacementInput, {
        idFactory: () => "invite_league_2",
        leagueTokenSecret,
      }),
      reissuePlatformInvitation(repository, replacementInput, {
        idFactory: () => "invite_league_3",
        leagueTokenSecret,
      }),
    ]);

    expect(second).toEqual(first);
    expect((await repository.listForSeason("season_2026")).filter(record =>
      record.kind === "league" && record.status === "pending"
    )).toHaveLength(1);
  });
});
