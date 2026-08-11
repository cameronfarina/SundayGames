import { describe, expect, it } from "vitest";
import {
  acceptPlatformInvitation,
  hashPlatformInvitationToken,
  InMemoryPlatformInvitationRepository,
  issuePlatformInvitation,
  listPlatformInvitations,
  PlatformInvitationError,
  reissuePlatformInvitation,
  revokePlatformInvitation,
} from "../src/platform/platformInvitations.js";

const now = new Date("2026-08-10T12:00:00.000Z");
const expiresAt = new Date("2026-08-17T12:00:00.000Z");

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
});
