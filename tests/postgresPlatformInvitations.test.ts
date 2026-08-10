import { describe, expect, it } from "vitest";
import {
  PostgresPlatformInvitationRepository,
  platformInvitationSchemaStatements,
  type PlatformInvitationPostgresRow,
} from "../src/platform/postgresPlatformInvitations.js";
import type { PostgresTransactionalQueryClient } from "../src/platform/postgresJobQueue.js";
import type { PostgresQueryClient, PostgresQueryResult } from "../src/platform/postgresPlatformStore.js";

const invitationRow: PlatformInvitationPostgresRow = {
  id: "invite_1",
  league_id: "league_1",
  season_id: "season_2026",
  email_normalized: "seth@example.com",
  role: "member",
  owner_id: "seth",
  team_id: "team_seth",
  owner_display_name: "Seth",
  team_display_name: "Seth's Team",
  invited_by_user_id: "acct_cam",
  token_hash: "token_hash",
  status: "pending",
  expires_at: new Date("2026-08-17T12:00:00.000Z"),
  created_at: new Date("2026-08-10T12:00:00.000Z"),
  accepted_at: null,
  accepted_by_user_id: null,
};

class InvitationClient implements PostgresTransactionalQueryClient {
  readonly queries: Array<{ sql: string; params: readonly unknown[] }> = [];
  transactionCount = 0;

  async query<TRow>(sql: string, params: readonly unknown[] = []): Promise<PostgresQueryResult<TRow>> {
    this.queries.push({ sql, params });
    if (sql.includes("UPDATE league_invitations") && sql.includes("RETURNING")) {
      return {
        rows: [{
          ...invitationRow,
          status: "accepted",
          accepted_at: params[2],
          accepted_by_user_id: params[1],
        } as TRow],
      };
    }
    if (sql.includes("INSERT INTO league_memberships")) return { rows: [{ id: "membership_1" } as TRow] };
    if (sql.includes("UPDATE fantasy_teams")) return { rows: [{ id: "team_seth" } as TRow] };
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
    expect(platformInvitationSchemaStatements.join("\n")).not.toContain("raw_token");
  });

  it("accepts an invitation, activates membership, and claims its team in one transaction", async () => {
    const client = new InvitationClient();
    const repository = new PostgresPlatformInvitationRepository(client, {
      membershipIdFactory: () => "membership_1",
    });

    const accepted = await repository.accept(
      "invite_1",
      "acct_seth",
      new Date("2026-08-11T12:00:00.000Z"),
    );

    expect(accepted).toMatchObject({
      id: "invite_1",
      status: "accepted",
      acceptedByUserId: "acct_seth",
    });
    expect(client.transactionCount).toBe(1);
    expect(client.queries[0]?.sql).toContain("status = 'pending'");
    expect(client.queries[0]?.sql).toContain("expires_at >= $3");
    expect(client.queries[1]?.sql).toContain("INSERT INTO league_memberships");
    expect(client.queries[1]?.sql).toContain("ON CONFLICT (league_id, user_id)");
    expect(client.queries[2]?.sql).toContain("UPDATE fantasy_teams");
    expect(client.queries[2]?.sql).toContain("owner_user_id IS NULL");
  });
});
