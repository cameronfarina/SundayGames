import { describe, expect, it } from "vitest";
import {
  PostgresPlatformInvitationRepository,
  platformInvitationSchemaStatements,
  type PlatformInvitationPostgresRow,
} from "../src/platform/postgresPlatformInvitations.js";
import type { PostgresTransactionalQueryClient } from "../src/platform/postgresJobQueue.js";
import type { PostgresQueryClient, PostgresQueryResult } from "../src/platform/postgresPlatformStore.js";
import type {
  PlatformInvitationKind,
  PlatformInvitationRecord,
} from "../src/platform/platformInvitations.js";
import type { WorkspaceRole } from "../src/platform/workspacePrivacy.js";
import {
  dateValueAt,
  nullableStringValueAt,
  stringValueAt,
} from "./support/postgresParameterValues.js";

const invitationRow: PlatformInvitationPostgresRow = {
  id: "invite_1",
  league_id: "league_1",
  season_id: "season_2026",
  invitation_kind: "team",
  email_normalized: "owner04@example.com",
  role: "member",
  owner_id: "owner04",
  team_id: "team_seth",
  owner_display_name: "Owner04",
  team_display_name: "Owner04's Team",
  invited_by_user_id: "acct_owner11",
  token_hash: "token_hash",
  status: "pending",
  expires_at: new Date("2026-08-17T12:00:00.000Z"),
  created_at: new Date("2026-08-10T12:00:00.000Z"),
  accepted_at: null,
  accepted_by_user_id: null,
};

const invitationKindValueAt = (
  values: readonly unknown[],
  index: number,
): PlatformInvitationKind => {
  const value = values[index];
  if (value !== "team" && value !== "league") throw new Error("Expected invitation kind.");
  return value;
};

const workspaceRoleValueAt = (values: readonly unknown[], index: number): WorkspaceRole => {
  const value = values[index];
  if (value !== "owner" && value !== "admin" && value !== "member" && value !== "observer") {
    throw new Error("Expected workspace role.");
  }
  return value;
};

class InvitationClient implements PostgresTransactionalQueryClient {
  readonly queries: Array<{ sql: string; params: readonly unknown[] }> = [];
  invitationInsertReturnsNoRows = false;
  invitationRevokeReturnsNoRows = false;
  transactionCount = 0;

  query<TRow = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<PostgresQueryResult<TRow>>;
  async query(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<unknown>> {
    this.queries.push({ sql, params });
    if (sql.includes("SET status = 'revoked'")) {
      if (this.invitationRevokeReturnsNoRows) return { rows: [] };
      return { rows: [{ id: stringValueAt(params, 0) }] };
    }
    if (sql.includes("INSERT INTO league_invitations")) {
      if (this.invitationInsertReturnsNoRows) return { rows: [] };
      return {
        rows: [{
          ...invitationRow,
          id: stringValueAt(params, 0),
          league_id: stringValueAt(params, 1),
          season_id: stringValueAt(params, 2),
          invitation_kind: invitationKindValueAt(params, 3),
          email_normalized: nullableStringValueAt(params, 4),
          role: workspaceRoleValueAt(params, 5),
          owner_id: nullableStringValueAt(params, 6),
          team_id: nullableStringValueAt(params, 7),
          owner_display_name: nullableStringValueAt(params, 8),
          team_display_name: nullableStringValueAt(params, 9),
          invited_by_user_id: stringValueAt(params, 10),
          token_hash: stringValueAt(params, 11),
          expires_at: dateValueAt(params, 12),
          created_at: dateValueAt(params, 13),
        }],
      };
    }
    if (sql.includes("FROM league_invitations") && sql.includes("invitation_kind = 'league'")) {
      return {
        rows: [{
          ...invitationRow,
          id: "invite_winner",
          invitation_kind: "league",
          email_normalized: null,
          owner_id: null,
          team_id: null,
          owner_display_name: null,
          team_display_name: null,
          token_hash: "winner_hash",
        }],
      };
    }
    if (sql.includes("UPDATE league_invitations") && sql.includes("RETURNING")) {
      return {
        rows: [{
          ...invitationRow,
          status: "accepted",
          accepted_at: dateValueAt(params, 2),
          accepted_by_user_id: stringValueAt(params, 1),
        }],
      };
    }
    if (sql.includes("INSERT INTO league_memberships")) return { rows: [{ id: "membership_1" }] };
    if (sql.includes("UPDATE fantasy_teams")) return { rows: [{ id: "team_seth" }] };
    return { rows: [] };
  }

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    return operation(this);
  }
}

describe("Postgres platform invitations", () => {
  it("provides a durable schema without storing raw invitation tokens", async () => {
    const client = new InvitationClient();

    await PostgresPlatformInvitationRepository.initializeSchema(client);

    expect(client.queries.map(query => query.sql)).toEqual(platformInvitationSchemaStatements);
    expect(platformInvitationSchemaStatements.join("\n")).toContain("token_hash text NOT NULL");
    expect(platformInvitationSchemaStatements.join("\n")).toContain("invitation_kind");
    expect(platformInvitationSchemaStatements.join("\n")).toContain("pending_league_key");
    expect(platformInvitationSchemaStatements.join("\n")).not.toContain("raw_token");
  });

  it("accepts an invitation, activates membership, and claims its team in one transaction", async () => {
    const client = new InvitationClient();
    const repository = new PostgresPlatformInvitationRepository(client, {
      membershipIdFactory: () => "membership_1",
    });

    const accepted = await repository.accept(
      "invite_1",
      "acct_owner04",
      new Date("2026-08-11T12:00:00.000Z"),
    );

    expect(accepted).toMatchObject({
      id: "invite_1",
      status: "accepted",
      acceptedByUserId: "acct_owner04",
    });
    expect(client.transactionCount).toBe(1);
    expect(client.queries[0]?.sql).toContain("status = 'pending'");
    expect(client.queries[0]?.sql).toContain("expires_at >= $3");
    expect(client.queries[1]?.sql).toContain("INSERT INTO league_memberships");
    expect(client.queries[1]?.sql).toContain("ON CONFLICT (league_id, user_id)");
    expect(client.queries[1]?.sql).not.toContain("role = EXCLUDED.role");
    expect(client.queries[2]?.sql).toContain("UPDATE fantasy_teams");
    expect(client.queries[2]?.sql).toContain("owner_user_id IS NULL");
  });

  it("replaces a pending invitation atomically", async () => {
    const client = new InvitationClient();
    const repository = new PostgresPlatformInvitationRepository(client);
    const replacement: PlatformInvitationRecord = {
      id: "invite_2",
      leagueId: "league_1",
      seasonId: "season_2026",
      kind: "team",
      email: "owner04@example.com",
      role: "member",
      ownerId: "owner04",
      teamId: "team_seth",
      ownerDisplayName: "Owner04",
      teamDisplayName: "Owner04's Team",
      invitedByUserId: "acct_owner11",
      tokenHash: "replacement_hash",
      status: "pending",
      expiresAt: new Date("2026-08-18T12:00:00.000Z"),
      createdAt: new Date("2026-08-11T12:00:00.000Z"),
    };

    await expect(repository.replacePending(
      "invite_1",
      replacement,
      replacement.createdAt,
    )).resolves.toMatchObject({ id: "invite_2", status: "pending" });
    expect(client.transactionCount).toBe(1);
    expect(client.queries[0]?.sql).toContain("SET status = 'revoked'");
    expect(client.queries[1]?.sql).toContain("INSERT INTO league_invitations");
  });

  it("returns the existing pending league link when a concurrent insert wins", async () => {
    const client = new InvitationClient();
    client.invitationInsertReturnsNoRows = true;
    const repository = new PostgresPlatformInvitationRepository(client);

    await expect(repository.savePending({
      id: "invite_loser",
      leagueId: "league_1",
      seasonId: "season_2026",
      kind: "league",
      role: "member",
      invitedByUserId: "acct_owner11",
      tokenHash: "loser_hash",
      status: "pending",
      expiresAt: new Date("2026-09-10T12:00:00.000Z"),
      createdAt: new Date("2026-08-11T12:00:00.000Z"),
    })).resolves.toMatchObject({ id: "invite_winner", kind: "league" });
    expect(client.queries[0]?.sql).toContain("ON CONFLICT (season_id)");
    expect(client.queries[1]?.sql).toContain("invitation_kind = 'league'");
  });

  it("returns the surviving pending league link when concurrent regeneration wins", async () => {
    const client = new InvitationClient();
    client.invitationRevokeReturnsNoRows = true;
    const repository = new PostgresPlatformInvitationRepository(client);

    await expect(repository.replacePending("invite_old", {
      id: "invite_loser",
      leagueId: "league_1",
      seasonId: "season_2026",
      kind: "league",
      role: "member",
      invitedByUserId: "acct_owner11",
      tokenHash: "loser_hash",
      status: "pending",
      expiresAt: new Date("2026-09-10T12:00:00.000Z"),
      createdAt: new Date("2026-08-11T12:00:00.000Z"),
    }, new Date("2026-08-11T12:00:00.000Z"))).resolves.toMatchObject({
      id: "invite_winner",
      kind: "league",
    });
    expect(client.queries).toHaveLength(2);
  });

});
