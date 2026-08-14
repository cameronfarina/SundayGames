import { describe, expect, it } from "vitest";
import type { PlatformInvitationPostgresRow } from "../src/platform/postgresPlatformInvitations.js";
import { invitationForRow } from "../src/platform/postgresPlatformInvitations/rowCodec.js";

const teamRow = (): PlatformInvitationPostgresRow => ({
  id: "invite_1",
  league_id: "league_1",
  season_id: "season_2026",
  invitation_kind: "team",
  email_normalized: "owner@example.com",
  role: "member",
  owner_id: "owner_1",
  team_id: "team_1",
  owner_display_name: "Owner One",
  team_display_name: "Team One",
  invited_by_user_id: "account_commissioner",
  token_hash: "token_hash_only",
  status: "accepted",
  expires_at: "2026-08-20T12:00:00.000Z",
  created_at: new Date("2026-08-10T12:00:00.000Z"),
  accepted_at: "2026-08-11T12:00:00.000Z",
  accepted_by_user_id: "account_owner",
  revoked_at: null,
});

describe("Postgres platform invitation row codec", () => {
  it("hydrates team invitation fields and copies all persisted dates", () => {
    const row = teamRow();
    const invitation = invitationForRow(row);

    expect(invitation).toEqual({
      id: "invite_1",
      leagueId: "league_1",
      seasonId: "season_2026",
      kind: "team",
      email: "owner@example.com",
      role: "member",
      ownerId: "owner_1",
      teamId: "team_1",
      ownerDisplayName: "Owner One",
      teamDisplayName: "Team One",
      invitedByUserId: "account_commissioner",
      tokenHash: "token_hash_only",
      status: "accepted",
      expiresAt: new Date("2026-08-20T12:00:00.000Z"),
      createdAt: new Date("2026-08-10T12:00:00.000Z"),
      acceptedAt: new Date("2026-08-11T12:00:00.000Z"),
      acceptedByUserId: "account_owner",
    });
    expect(invitation.expiresAt).not.toBe(row.expires_at);
    expect(invitation.createdAt).not.toBe(row.created_at);
  });

  it("hydrates a league invitation without team identity fields", () => {
    const invitation = invitationForRow({
      ...teamRow(),
      invitation_kind: "league",
      email_normalized: null,
      owner_id: null,
      team_id: null,
      owner_display_name: null,
      team_display_name: null,
      status: "pending",
      accepted_at: null,
      accepted_by_user_id: null,
    });

    expect(invitation).toMatchObject({ kind: "league", status: "pending" });
    expect("email" in invitation).toBe(false);
    expect("acceptedAt" in invitation).toBe(false);
  });

  it("rejects malformed team rows instead of returning incomplete identity data", () => {
    expect(() => invitationForRow({
      ...teamRow(),
      team_id: null,
    })).toThrow("Team invitation is missing its team-specific fields.");
  });
});
