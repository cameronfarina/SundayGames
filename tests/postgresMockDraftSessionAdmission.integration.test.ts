import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createNodePostgresClient,
  type NodePostgresClient,
} from "../src/platform/postgresClient.js";
import { applyPlatformPostgresMigrations } from "../src/platform/platformMigrations.js";
import { PostgresMockDraftSessionRepository } from "../src/platform/postgresMockDraftSessions.js";

const databaseUrl = process.env.MOCKD_POSTGRES_INTEGRATION_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl === undefined || databaseUrl.length === 0
  ? describe.skip
  : describe;

const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;

describeWithPostgres("Postgres mock-session admission", () => {
  let adminClient: NodePostgresClient;
  let client: NodePostgresClient;
  let schemaName: string;

  beforeAll(async () => {
    if (databaseUrl === undefined || databaseUrl.length === 0) {
      throw new Error("MOCKD_POSTGRES_INTEGRATION_DATABASE_URL is required.");
    }
    schemaName = `mockd_mock_admission_${randomUUID().replaceAll("-", "")}`;
    adminClient = createNodePostgresClient({ databaseUrl, max: 1 });
    await adminClient.query(`CREATE SCHEMA ${quoteIdentifier(schemaName)}`);
    const isolatedUrl = new URL(databaseUrl);
    isolatedUrl.searchParams.set("options", `-c search_path=${schemaName}`);
    client = createNodePostgresClient({ databaseUrl: isolatedUrl.toString(), max: 4 });
    await applyPlatformPostgresMigrations(client);
    await client.query(
      `INSERT INTO accounts (id, email, email_normalized, password_hash)
       VALUES ('user_cam', 'owner11@example.com', 'owner11@example.com', 'hash')`,
    );
    await client.query(
      `INSERT INTO leagues (id, name, slug, created_by_user_id)
       VALUES ('league_100001', 'Sunday Games', 'sunday-games', 'user_cam')`,
    );
    await client.query(
      `INSERT INTO league_seasons (id, league_id, season_year, name)
       VALUES ('season_2026', 'league_100001', 2026, '2026')`,
    );
    await client.query(
      `INSERT INTO fantasy_teams (
         id, league_season_id, team_key, team_name, owner_name, display_order
       ) VALUES ('team_cam', 'season_2026', 'owner11', 'Short King', 'Owner11', 1)`,
    );
  }, 30_000);

  afterAll(async () => {
    await client?.close();
    if (adminClient !== undefined && schemaName !== undefined) {
      await adminClient.query(`DROP SCHEMA ${quoteIdentifier(schemaName)} CASCADE`);
    }
    await adminClient?.close();
  });

  it("serializes limit-plus-one creates before applying the active-session quota", async () => {
    const repository = new PostgresMockDraftSessionRepository(client, {
      maxActiveSessionsPerUser: 1,
      maxActiveSessionsPerUserSeason: 1,
    });
    const input = {
      userId: "user_cam",
      leagueId: "league_100001",
      seasonId: "season_2026",
      ownerId: "owner_cam",
      teamId: "team_cam",
      draftMode: { format: "auction" as const, mockCount: 1 },
      now: new Date("2026-08-20T12:00:00.000Z"),
    };

    const outcomes = await Promise.allSettled([
      repository.createSession(input),
      repository.createSession({ ...input, now: new Date(input.now.getTime() + 1) }),
    ]);

    expect(outcomes.filter(outcome => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(outcome => outcome.status === "rejected")).toEqual([
      expect.objectContaining({
        reason: expect.objectContaining({ code: "season_active_session_limit" }),
      }),
    ]);
    const count = await client.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM mock_sessions WHERE user_id = $1",
      [input.userId],
    );
    expect(count.rows[0]?.count).toBe(1);
  }, 30_000);
});
