import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyPlatformPostgresMigrations } from "../src/platform/platformMigrations.js";
import {
  createNodePostgresClient,
  type NodePostgresClient,
} from "../src/platform/postgresClient.js";
import { PostgresMockDraftSessionRepository } from
  "../src/platform/postgresMockDraftSessions.js";
import { finalizePracticePersistenceCutover } from
  "../src/platform/practicePersistenceCutover.js";
import { persistedMockDraftSessions } from "./platformStoreSnapshotFixtures/mockSessions.js";

const databaseUrl = process.env.MOCKD_POSTGRES_INTEGRATION_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl === undefined || databaseUrl.length === 0
  ? describe.skip
  : describe;
const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;

const command = (id: string, text: string) => ({
  id,
  idempotencyKey: id,
  command: text,
  revision: 1,
  createdAt: "2026-08-20T12:01:00.000Z",
});
const replayConfiguration = persistedMockDraftSessions()[0]?.configurationSnapshot;
if (replayConfiguration === undefined) throw new Error("Expected mock replay configuration.");

describeWithPostgres("practice-persistence rolling cutover", () => {
  let adminClient: NodePostgresClient;
  let client: NodePostgresClient;
  let schemaName: string;
  const sessionId = "mock_sess_rollout";
  const snapshotKey = "rollout";

  beforeAll(async () => {
    if (databaseUrl === undefined) throw new Error("Integration database is required.");
    schemaName = `mockd_practice_rollout_${randomUUID().replaceAll("-", "")}`;
    adminClient = createNodePostgresClient({ databaseUrl, max: 1 });
    await adminClient.query(`CREATE SCHEMA ${quoteIdentifier(schemaName)}`);
    const isolatedUrl = new URL(databaseUrl);
    isolatedUrl.searchParams.set("options", `-c search_path=${schemaName}`);
    client = createNodePostgresClient({ databaseUrl: isolatedUrl.toString(), max: 4 });
    await applyPlatformPostgresMigrations(client);
    await client.query(`INSERT INTO accounts (id, email, email_normalized, password_hash)
      VALUES ('user_cam', 'owner@example.com', 'owner@example.com', 'hash')`);
    await client.query(`INSERT INTO leagues (id, name, slug, created_by_user_id)
      VALUES ('league_1', 'Sunday Games', 'sunday-games', 'user_cam')`);
    await client.query(`INSERT INTO league_seasons (id, league_id, season_year, name)
      VALUES ('season_1', 'league_1', 2026, '2026')`);
    await client.query(`INSERT INTO fantasy_teams (
      id, league_season_id, team_key, team_name, owner_name, display_order
    ) VALUES ('team_1', 'season_1', 'owner', 'Team', 'Owner', 1)`);
  }, 30_000);

  afterAll(async () => {
    await client?.close();
    if (adminClient !== undefined && schemaName !== undefined) {
      await adminClient.query(`DROP SCHEMA ${quoteIdentifier(schemaName)} CASCADE`);
    }
    await adminClient?.close();
  });

  const session = (commands: readonly ReturnType<typeof command>[]) => ({
    id: sessionId,
    userId: "user_cam",
    leagueId: "league_1",
    seasonId: "season_1",
    ownerId: "owner",
    teamId: "team_1",
    status: "active",
    revision: 1,
    commandLog: commands,
    draftMode: { format: "auction", mockCount: 1 },
    configurationSnapshot: replayConfiguration,
    createdAt: "2026-08-20T12:00:00.000Z",
    updatedAt: "2026-08-20T12:02:00.000Z",
    startedAt: "2026-08-20T12:00:00.000Z",
  });

  const saveCompatibilitySnapshot = async (
    revision: number,
    commands: readonly ReturnType<typeof command>[],
  ) => await client.query(`INSERT INTO platform_store_snapshots (
      snapshot_key, schema_version, revision, snapshot_hash, snapshot_json
    ) VALUES ($1, 1, $2, 'hash', $3::jsonb)
    ON CONFLICT (snapshot_key) DO UPDATE SET
      revision = EXCLUDED.revision, snapshot_json = EXCLUDED.snapshot_json
    RETURNING revision`, [snapshotKey, revision, JSON.stringify({
      mockDraftSessions: [session(commands)],
    })]);

  it("ignores stale prefixes and rejects divergent old-node histories atomically", async () => {
    const control = await client.query<{ mode: string }>(
      "SELECT mode FROM platform_practice_persistence_control WHERE singleton = true",
    );
    expect(control.rows[0]?.mode).toBe("dual-write");
    const first = command("first", "first");
    await saveCompatibilitySnapshot(1, [first]);
    const repository = new PostgresMockDraftSessionRepository(client);
    await repository.appendCommand({
      userId: "user_cam",
      sessionId,
      expectedRevision: 1,
      expectedCommandCount: 1,
      commandId: "second",
      command: "second",
      now: new Date("2026-08-20T12:03:00.000Z"),
    });

    await saveCompatibilitySnapshot(2, [first]);
    await expect(saveCompatibilitySnapshot(3, [first, command("fork", "fork")]))
      .rejects.toThrow("Mock draft command history diverged");

    await expect(repository.getSession({
      userId: "user_cam",
      sessionId,
      now: new Date("2026-08-20T12:04:00.000Z"),
    })).resolves.toMatchObject({
      configurationSnapshot: { status: "ready" },
      commandLog: [{ id: "first" }, { id: "second" }],
    });
  }, 30_000);

  it("prevents an unrelated old-node snapshot save from resurrecting a retained session", async () => {
    const repository = new PostgresMockDraftSessionRepository(client);
    await repository.abandonSession({
      userId: "user_cam",
      sessionId,
      expectedRevision: 1,
      now: new Date("2026-08-20T12:05:00.000Z"),
    });
    await finalizePracticePersistenceCutover(client);
    const cutover = await client.query<{
      mode: string;
      snapshot_hash: string;
      mock_sessions: unknown;
    }>(`SELECT control.mode, snapshot.snapshot_hash,
          snapshot.snapshot_json->'mockDraftSessions' AS mock_sessions
        FROM platform_practice_persistence_control AS control
        JOIN platform_store_snapshots AS snapshot ON snapshot.snapshot_key = $1
        WHERE control.singleton = true`, [snapshotKey]);
    expect(cutover.rows[0]).toMatchObject({
      mode: "normalized-only",
      mock_sessions: [],
    });
    expect(cutover.rows[0]?.snapshot_hash).not.toBe("hash");
    await repository.listSessionsForOwner({
      userId: "user_cam",
      leagueId: "league_1",
      seasonId: "season_1",
      ownerId: "owner",
      now: new Date("2026-08-20T14:00:00.000Z"),
    });
    // This models a pre-cutover process finishing an unrelated snapshot mutation
    // with the stale mock-session copy it loaded before the bridge was retired.
    await saveCompatibilitySnapshot(10, [command("first", "first")]);

    const count = await client.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM mock_sessions WHERE id = $1",
      [sessionId],
    );
    expect(count.rows[0]?.count).toBe(0);
  }, 30_000);
});
