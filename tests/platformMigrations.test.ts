import { describe, expect, it } from "vitest";
import {
  applyPlatformPostgresMigrations,
  findMissingPlatformPostgresMigrations,
  requiredPlatformPostgresMigrationIds,
} from "../src/platform/platformMigrations.js";
import { platformPostgresMigrationStatements } from "../src/platform/postgresSchema.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";
import type { PostgresTransactionalQueryClient } from "../src/platform/postgresJobQueue.js";

class RecordingPostgresClient implements PostgresTransactionalQueryClient {
  readonly statements: string[] = [];
  readonly appliedMigrationIds = new Set<string>();
  duplicateRealDraftRooms: Array<{ league_season_id: string; room_ids: string[] }> = [];
  transactionCount = 0;

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    this.statements.push(text);
    if (text.includes("SELECT id FROM platform_schema_migrations")) {
      const migrationId = values[0];
      return {
        rows: typeof migrationId === "string" && this.appliedMigrationIds.has(migrationId)
          ? [{ id: migrationId } as TRow]
          : [],
      };
    }

    if (text.includes("HAVING COUNT(*) > 1")) {
      return { rows: this.duplicateRealDraftRooms as TRow[] };
    }

    return { rows: [] };
  }

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    this.transactionCount += 1;

    return operation(this);
  }
}

describe("platform Postgres migrations", () => {
  it("applies the snapshot bridge schema before normalized platform tables", async () => {
    const client = new RecordingPostgresClient();

    const result = await applyPlatformPostgresMigrations(client);

    expect(result.statementCount).toBeGreaterThan(platformPostgresMigrationStatements.length + 2);
    expect(client.transactionCount).toBe(1);
    expect(client.statements[0]).toBe("SELECT pg_advisory_xact_lock($1, $2)");
    expect(client.statements[1]).toContain("CREATE TABLE IF NOT EXISTS platform_store_snapshots");
    expect(client.statements[2]).toContain("CREATE INDEX IF NOT EXISTS platform_store_snapshots_updated_at_idx");
    expect(client.statements[3]).toContain("CREATE TABLE IF NOT EXISTS platform_schema_migrations");
    expect(client.statements[4]).toContain("SELECT id FROM platform_schema_migrations");
    expect(client.statements[5]).toBe(platformPostgresMigrationStatements[0]);
    expect(client.statements.at(-1)).toContain("INSERT INTO platform_schema_migrations");
  });

  it("upgrades an existing v1 database to support paused live rooms", async () => {
    const client = new RecordingPostgresClient();
    client.appliedMigrationIds.add("platform-schema-v1");

    const result = await applyPlatformPostgresMigrations(client);

    expect(result.statementCount).toBeGreaterThan(0);
    expect(client.transactionCount).toBe(1);
    expect(client.statements).toContainEqual(
      expect.stringContaining("DROP CONSTRAINT IF EXISTS draft_rooms_status_check"),
    );
    expect(client.statements).toContainEqual(
      expect.stringContaining("status IN ('setup', 'countdown', 'live', 'paused', 'ended')"),
    );
  });

  it("skips every schema statement when all migrations are applied", async () => {
    const client = new RecordingPostgresClient();
    requiredPlatformPostgresMigrationIds.forEach(migrationId => client.appliedMigrationIds.add(migrationId));

    const result = await applyPlatformPostgresMigrations(client);

    expect(result).toEqual({ statementCount: 0 });
    expect(client.transactionCount).toBe(1);
    expect(client.statements.filter(statement => statement.includes("SELECT id")))
      .toHaveLength(requiredPlatformPostgresMigrationIds.length);
  });

  it("allows existing databases to persist price-less snake picks", async () => {
    const client = new RecordingPostgresClient();
    requiredPlatformPostgresMigrationIds
      .filter(migrationId => migrationId !== "platform-snake-live-room-v20")
      .forEach(migrationId => client.appliedMigrationIds.add(migrationId));

    await applyPlatformPostgresMigrations(client);

    expect(client.statements).toContain(
      "ALTER TABLE draft_room_sales ALTER COLUMN price DROP NOT NULL;",
    );
  });

  it("backfills stable league slugs before enforcing their public URL contract", async () => {
    const client = new RecordingPostgresClient();
    [
      "platform-schema-v1",
      "platform-live-room-paused-v2",
      "platform-invitations-v3",
      "platform-live-room-setup-v4",
      "platform-auth-version-v5",
      "platform-team-identities-v6",
      "platform-league-formats-v7",
      "platform-auth-ownership-v8",
      "platform-historical-pricing-ownership-v9",
      "platform-shared-league-invitations-v10",
      "platform-league-archive-v11",
      "platform-auth-token-version-v12",
    ].forEach(migrationId => client.appliedMigrationIds.add(migrationId));

    await applyPlatformPostgresMigrations(client);

    expect(client.statements).toContain("ALTER TABLE leagues ADD COLUMN IF NOT EXISTS slug text;");
    expect(client.statements).toContainEqual(expect.stringContaining(
      "WHILE EXISTS (SELECT 1 FROM leagues WHERE slug = candidate_slug)",
    ));
    expect(client.statements).toContainEqual(expect.stringContaining(
      "UPDATE leagues SET slug = candidate_slug",
    ));
    expect(client.statements).toContain("ALTER TABLE leagues ALTER COLUMN slug SET NOT NULL;");
    expect(client.statements).toContain("CREATE UNIQUE INDEX IF NOT EXISTS leagues_slug_key ON leagues (slug);");
  });

  it("adds durable league invitations to an existing platform database", async () => {
    const client = new RecordingPostgresClient();
    client.appliedMigrationIds.add("platform-schema-v1");
    client.appliedMigrationIds.add("platform-live-room-paused-v2");

    const result = await applyPlatformPostgresMigrations(client);

    expect(result.statementCount).toBeGreaterThan(0);
    expect(client.statements).toContainEqual(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS league_invitations"),
    );
    expect(client.statements).toContainEqual(
      expect.stringContaining("league_invitations_pending_team_key"),
    );
  });

  it("adds live-room setup data and one real room per season to an existing database", async () => {
    const client = new RecordingPostgresClient();
    client.appliedMigrationIds.add("platform-schema-v1");
    client.appliedMigrationIds.add("platform-live-room-paused-v2");
    client.appliedMigrationIds.add("platform-invitations-v3");

    const result = await applyPlatformPostgresMigrations(client);

    expect(result.statementCount).toBeGreaterThan(0);
    expect(client.statements).toContainEqual(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS league_season_draft_setups"),
    );
    expect(client.statements).toContainEqual(
      expect.stringContaining("CREATE UNIQUE INDEX IF NOT EXISTS draft_rooms_real_season_key"),
    );
    expect(client.statements.findIndex(statement => statement.includes("HAVING COUNT(*) > 1")))
      .toBeLessThan(client.statements.findIndex(statement =>
        statement.includes("CREATE TABLE IF NOT EXISTS league_season_draft_setups")
      ));
  });

  it("fails v4 before DDL when an existing season has multiple real rooms", async () => {
    const client = new RecordingPostgresClient();
    client.appliedMigrationIds.add("platform-schema-v1");
    client.appliedMigrationIds.add("platform-live-room-paused-v2");
    client.appliedMigrationIds.add("platform-invitations-v3");
    client.duplicateRealDraftRooms = [
      {
        league_season_id: "league-1-season-2026",
        room_ids: ["room-old", "room-new"],
      },
    ];

    await expect(applyPlatformPostgresMigrations(client)).rejects.toThrow(
      "Cannot apply platform-live-room-setup-v4: multiple real draft rooms exist for the same season: "
      + "league-1-season-2026 (room-old, room-new). Preserve the authoritative room and remove or "
      + "reclassify the duplicate rooms, then rerun the migration.",
    );
    expect(client.statements).not.toContainEqual(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS league_season_draft_setups"),
    );
    expect(client.statements).not.toContainEqual(
      expect.stringContaining("CREATE UNIQUE INDEX IF NOT EXISTS draft_rooms_real_season_key"),
    );
    expect(client.appliedMigrationIds).not.toContain("platform-live-room-setup-v4");
  });

  it("adds an authentication version to existing accounts and sessions", async () => {
    const client = new RecordingPostgresClient();
    [
      "platform-schema-v1",
      "platform-live-room-paused-v2",
      "platform-invitations-v3",
      "platform-live-room-setup-v4",
      "platform-team-identities-v6",
      "platform-league-formats-v7",
      "platform-auth-ownership-v8",
      "platform-historical-pricing-ownership-v9",
      "platform-shared-league-invitations-v10",
      "platform-league-archive-v11",
      "platform-auth-token-version-v12",
      "platform-league-slug-v13",
      "platform-player-news-v14",
      "platform-fantasypros-v15",
      "platform-player-news-v16",
      "platform-league-sync-v18",
      "platform-league-import-v19",
      "platform-snake-live-room-v20",
      "platform-league-credential-encryption-v21",
      "platform-auth-rate-limits-v22",
      "platform-league-sync-revisions-v23",
      "platform-live-draft-scale-v24",
      "platform-practice-persistence-v25",
      "platform-browser-simulation-lifecycle-v26",
    ].forEach(migrationId => client.appliedMigrationIds.add(migrationId));

    await expect(applyPlatformPostgresMigrations(client)).resolves.toEqual({ statementCount: 4 });
    expect(client.statements).toContain(
      "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS auth_version bigint NOT NULL DEFAULT 1;",
    );
    expect(client.statements).toContain(
      "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auth_version bigint NOT NULL DEFAULT 1;",
    );
  });

  it("adds imported team identity fields to existing fantasy teams", async () => {
    const client = new RecordingPostgresClient();
    [
      "platform-schema-v1",
      "platform-live-room-paused-v2",
      "platform-invitations-v3",
      "platform-live-room-setup-v4",
      "platform-auth-version-v5",
      "platform-league-formats-v7",
      "platform-auth-ownership-v8",
      "platform-historical-pricing-ownership-v9",
      "platform-shared-league-invitations-v10",
      "platform-league-archive-v11",
      "platform-auth-token-version-v12",
      "platform-league-slug-v13",
      "platform-player-news-v14",
      "platform-fantasypros-v15",
      "platform-player-news-v16",
      "platform-league-sync-v18",
      "platform-league-import-v19",
      "platform-snake-live-room-v20",
      "platform-league-credential-encryption-v21",
      "platform-auth-rate-limits-v22",
      "platform-league-sync-revisions-v23",
      "platform-live-draft-scale-v24",
      "platform-practice-persistence-v25",
      "platform-browser-simulation-lifecycle-v26",
    ].forEach(migrationId => client.appliedMigrationIds.add(migrationId));

    await expect(applyPlatformPostgresMigrations(client)).resolves.toEqual({ statementCount: 4 });
    expect(client.statements).toContain(
      "ALTER TABLE fantasy_teams ADD COLUMN IF NOT EXISTS abbreviation text;",
    );
    expect(client.statements).toContain(
      "ALTER TABLE fantasy_teams ADD COLUMN IF NOT EXISTS manager_names_json jsonb NOT NULL DEFAULT '[]'::jsonb;",
    );
  });

  it("adds total sync revisions without rewriting existing connection data", async () => {
    const client = new RecordingPostgresClient();
    requiredPlatformPostgresMigrationIds
      .filter(migrationId => migrationId !== "platform-league-sync-revisions-v23")
      .forEach(migrationId => client.appliedMigrationIds.add(migrationId));

    const result = await applyPlatformPostgresMigrations(client);

    expect(result.statementCount).toBe(4);
    expect(client.statements).toContain(
      "ALTER TABLE league_connections ADD COLUMN IF NOT EXISTS sync_revision bigint NOT NULL DEFAULT 0;",
    );
    expect(client.statements).toContain(
      "ALTER TABLE league_connection_snapshots ADD COLUMN IF NOT EXISTS sync_revision bigint NOT NULL DEFAULT 0;",
    );
  });

  it("adds durable mock replay state after the reserved v24 stack position", async () => {
    const client = new RecordingPostgresClient();
    requiredPlatformPostgresMigrationIds
      .filter(migrationId => migrationId !== "platform-practice-persistence-v25")
      .forEach(migrationId => client.appliedMigrationIds.add(migrationId));

    const result = await applyPlatformPostgresMigrations(client);

    expect(requiredPlatformPostgresMigrationIds.at(-3)).toBe("platform-live-draft-scale-v24");
    expect(requiredPlatformPostgresMigrationIds.at(-2)).toBe("platform-practice-persistence-v25");
    expect(requiredPlatformPostgresMigrationIds.at(-1))
      .toBe("platform-browser-simulation-lifecycle-v26");
    expect(result.statementCount).toBeGreaterThan(0);
    expect(client.statements).toContain(
      "ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS configuration_snapshot_json jsonb NOT NULL DEFAULT '{\"status\":\"migration-required\",\"schema\":\"mockd-season-mock-configuration\",\"reason\":\"missing-snapshot\"}'::jsonb;",
    );
    expect(client.statements).toContainEqual(
      expect.stringContaining("CREATE OR REPLACE FUNCTION mirror_platform_snapshot_mock_sessions"),
    );
    expect(client.statements).toContainEqual(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS platform_practice_persistence_control"),
    );
    expect(client.statements).toContainEqual(
      expect.stringContaining("VALUES (true, 'dual-write')"),
    );
    expect(client.statements).toContainEqual(
      expect.stringContaining("CREATE TRIGGER platform_snapshot_mock_sessions_bridge"),
    );
    expect(client.statements).toContainEqual(
      expect.stringContaining("practice_mode <> 'dual-write'"),
    );
    expect(client.statements).toContainEqual(
      expect.stringContaining("Compatibility mock sessions are disabled after normalized-only cutover"),
    );
    expect(client.statements).toContainEqual(
      expect.stringContaining("Mock draft command history diverged during compatibility mirroring"),
    );
    expect(client.statements).toContainEqual(
      expect.stringContaining("WHERE ordinal > shared_count"),
    );
    expect(client.statements).toContainEqual(
      expect.stringContaining("Compatibility mock draft command persistence is inconsistent"),
    );
    expect(client.statements).toContainEqual(
      expect.stringContaining("WHERE id = stored_session->>'userId'\n    FOR UPDATE"),
    );
    expect(client.statements).toContain(
      "UPDATE platform_store_snapshots SET snapshot_json = snapshot_json;",
    );
  });

  it("adds format-aware roster settings to existing auction seasons", async () => {
    const client = new RecordingPostgresClient();
    [
      "platform-schema-v1",
      "platform-live-room-paused-v2",
      "platform-invitations-v3",
      "platform-live-room-setup-v4",
      "platform-auth-version-v5",
      "platform-team-identities-v6",
      "platform-auth-ownership-v8",
      "platform-historical-pricing-ownership-v9",
      "platform-shared-league-invitations-v10",
      "platform-league-archive-v11",
      "platform-auth-token-version-v12",
    ].forEach(migrationId => client.appliedMigrationIds.add(migrationId));

    const result = await applyPlatformPostgresMigrations(client);

    expect(result.statementCount).toBeGreaterThan(0);
    expect(client.statements).toContain(
      "ALTER TABLE roster_rule_sets ADD COLUMN IF NOT EXISTS draft_format text NOT NULL DEFAULT 'auction';",
    );
    expect(client.statements).toContain(
      "ALTER TABLE roster_rule_sets ADD COLUMN IF NOT EXISTS snake_json jsonb;",
    );
    expect(client.statements).toContain(
      "ALTER TABLE roster_rule_sets ALTER COLUMN budget DROP NOT NULL;",
    );
    expect(client.statements).toContainEqual(
      expect.stringContaining("roster_rule_sets_format_settings_check"),
    );
  });

  it("adds verified ownership and single-use auth tokens to existing accounts", async () => {
    const client = new RecordingPostgresClient();
    [
      "platform-schema-v1",
      "platform-live-room-paused-v2",
      "platform-invitations-v3",
      "platform-live-room-setup-v4",
      "platform-auth-version-v5",
      "platform-team-identities-v6",
      "platform-league-formats-v7",
      "platform-historical-pricing-ownership-v9",
      "platform-shared-league-invitations-v10",
      "platform-league-archive-v11",
    ].forEach(migrationId => client.appliedMigrationIds.add(migrationId));

    const result = await applyPlatformPostgresMigrations(client);

    expect(result.statementCount).toBeGreaterThan(0);
    expect(client.statements).toContain(
      "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;",
    );
    expect(client.statements).toContain(
      "UPDATE accounts SET email_verified_at = created_at WHERE email_verified_at IS NULL;",
    );
    expect(client.statements).toContainEqual(expect.stringContaining("account_auth_tokens"));
  });

  it("versions auth tokens against the credential that issued them", async () => {
    const client = new RecordingPostgresClient();
    requiredPlatformPostgresMigrationIds
      .filter(id => id !== "platform-auth-token-version-v12")
      .forEach(id => client.appliedMigrationIds.add(id));

    await applyPlatformPostgresMigrations(client);

    expect(client.statements).toContainEqual(
      "ALTER TABLE account_auth_tokens ADD COLUMN IF NOT EXISTS auth_version bigint NOT NULL DEFAULT 1;",
    );
  });

  it("reports every required migration missing from the migration ledger", async () => {
    const client = new RecordingPostgresClient();
    client.appliedMigrationIds.add("platform-schema-v1");

    await expect(findMissingPlatformPostgresMigrations(client)).resolves.toEqual([
      "platform-live-room-paused-v2",
      "platform-invitations-v3",
      "platform-live-room-setup-v4",
      "platform-auth-version-v5",
      "platform-team-identities-v6",
      "platform-league-formats-v7",
      "platform-auth-ownership-v8",
      "platform-historical-pricing-ownership-v9",
      "platform-shared-league-invitations-v10",
      "platform-league-archive-v11",
      "platform-auth-token-version-v12",
      "platform-league-slug-v13",
      "platform-player-news-v14",
      "platform-fantasypros-v15",
      "platform-player-news-v16",
      "platform-league-sync-v18",
      "platform-league-import-v19",
      "platform-snake-live-room-v20",
      "platform-league-credential-encryption-v21",
      "platform-auth-rate-limits-v22",
      "platform-league-sync-revisions-v23",
      "platform-live-draft-scale-v24",
      "platform-practice-persistence-v25",
      "platform-browser-simulation-lifecycle-v26",
    ]);
    expect(requiredPlatformPostgresMigrationIds).toEqual([
      "platform-schema-v1",
      "platform-live-room-paused-v2",
      "platform-invitations-v3",
      "platform-live-room-setup-v4",
      "platform-auth-version-v5",
      "platform-team-identities-v6",
      "platform-league-formats-v7",
      "platform-auth-ownership-v8",
      "platform-historical-pricing-ownership-v9",
      "platform-shared-league-invitations-v10",
      "platform-league-archive-v11",
      "platform-auth-token-version-v12",
      "platform-league-slug-v13",
      "platform-player-news-v14",
      "platform-fantasypros-v15",
      "platform-player-news-v16",
      "platform-league-sync-v18",
      "platform-league-import-v19",
      "platform-snake-live-room-v20",
      "platform-league-credential-encryption-v21",
      "platform-auth-rate-limits-v22",
      "platform-league-sync-revisions-v23",
      "platform-live-draft-scale-v24",
      "platform-practice-persistence-v25",
      "platform-browser-simulation-lifecycle-v26",
    ]);
  });

  it("applies the import-through-browser-simulation migrations in reserved order", () => {
    expect(requiredPlatformPostgresMigrationIds.slice(-8)).toEqual([
      "platform-league-import-v19",
      "platform-snake-live-room-v20",
      "platform-league-credential-encryption-v21",
      "platform-auth-rate-limits-v22",
      "platform-league-sync-revisions-v23",
      "platform-live-draft-scale-v24",
      "platform-practice-persistence-v25",
      "platform-browser-simulation-lifecycle-v26",
    ]);
  });

  it("indexes terminal and stale requested simulation cleanup in v26", async () => {
    const client = new RecordingPostgresClient();
    requiredPlatformPostgresMigrationIds
      .filter(migrationId => migrationId !== "platform-browser-simulation-lifecycle-v26")
      .forEach(migrationId => client.appliedMigrationIds.add(migrationId));

    const result = await applyPlatformPostgresMigrations(client);

    expect(result.statementCount).toBe(3);
    expect(client.statements).toContain(
      "CREATE INDEX IF NOT EXISTS simulation_runs_cleanup_status_created_at_idx " +
      "ON simulation_runs (status, created_at) " +
      "WHERE status IN ('requested', 'failed', 'canceled');",
    );
  });

  it("adds the durable current-room projection and shared stream leases in v24", async () => {
    const client = new RecordingPostgresClient();
    requiredPlatformPostgresMigrationIds
      .filter(migrationId => migrationId !== "platform-live-draft-scale-v24")
      .forEach(migrationId => client.appliedMigrationIds.add(migrationId));

    await applyPlatformPostgresMigrations(client);

    expect(client.statements).toContain(
      "ALTER TABLE draft_rooms ADD COLUMN IF NOT EXISTS current_projection_json jsonb;",
    );
    expect(client.statements).toContainEqual(expect.stringContaining(
      "CREATE TABLE IF NOT EXISTS live_draft_stream_leases",
    ));
    expect(client.statements).toContainEqual(expect.stringContaining(
      "CREATE INDEX IF NOT EXISTS live_draft_stream_leases_account_expires_idx",
    ));
  });

  it("adds durable league archive metadata and an active-league index", async () => {
    const client = new RecordingPostgresClient();
    requiredPlatformPostgresMigrationIds
      .filter(migrationId => migrationId !== "platform-league-archive-v11")
      .forEach(migrationId => client.appliedMigrationIds.add(migrationId));

    const result = await applyPlatformPostgresMigrations(client);

    expect(result.statementCount).toBeGreaterThan(0);
    expect(client.statements).toContain(
      "ALTER TABLE leagues ADD COLUMN IF NOT EXISTS archived_at timestamptz;",
    );
    expect(client.statements).toContain(
      "ALTER TABLE leagues ADD COLUMN IF NOT EXISTS archived_by_user_id text REFERENCES accounts(id) ON DELETE RESTRICT;",
    );
    expect(client.statements).toContainEqual(expect.stringContaining("leagues_active_created_by_user_id_idx"));
  });

  it("upgrades team invitations to support one reusable league link", async () => {
    const client = new RecordingPostgresClient();
    requiredPlatformPostgresMigrationIds
      .filter(migrationId => migrationId !== "platform-shared-league-invitations-v10")
      .forEach(migrationId => client.appliedMigrationIds.add(migrationId));

    const result = await applyPlatformPostgresMigrations(client);

    expect(result.statementCount).toBeGreaterThan(0);
    expect(client.statements).toContain(
      "ALTER TABLE league_invitations ADD COLUMN IF NOT EXISTS invitation_kind text NOT NULL DEFAULT 'team';",
    );
    expect(client.statements).toContainEqual(expect.stringContaining("pending_league_key"));
    expect(client.statements).toContainEqual(expect.stringContaining("invitation_kind = 'league'"));
  });

  it("remembers which season a connection imported without risking the connection", async () => {
    const client = new RecordingPostgresClient();
    requiredPlatformPostgresMigrationIds
      .filter(migrationId => migrationId !== "platform-league-import-v19")
      .forEach(migrationId => client.appliedMigrationIds.add(migrationId));

    const result = await applyPlatformPostgresMigrations(client);

    expect(result.statementCount).toBeGreaterThan(0);
    expect(client.statements).toContain(
      "ALTER TABLE league_connections ADD COLUMN IF NOT EXISTS league_season_id text;",
    );
    // Deleting the imported league clears the link instead of the connection.
    expect(client.statements).toContainEqual(expect.stringContaining("ON DELETE SET NULL"));
  });

  it("adds rolling-safe encrypted credential columns without rewriting plaintext rows", async () => {
    const client = new RecordingPostgresClient();
    requiredPlatformPostgresMigrationIds
      .filter(migrationId => migrationId !== "platform-league-credential-encryption-v21")
      .forEach(migrationId => client.appliedMigrationIds.add(migrationId));

    const result = await applyPlatformPostgresMigrations(client);

    expect(result.statementCount).toBeGreaterThan(0);
    expect(client.statements).toContain(
      "ALTER TABLE league_connections ADD COLUMN IF NOT EXISTS credentials_ciphertext text;",
    );
    expect(client.statements).toContain(
      "ALTER TABLE league_connections ADD COLUMN IF NOT EXISTS credentials_key_id text;",
    );
    expect(client.statements).toContainEqual(expect.stringContaining(
      "league_connections_encrypted_credentials_pair_check",
    ));
    expect(client.statements.join("\n")).not.toContain("UPDATE league_connections SET espn_s2");
  });

  it("adds shared authentication rate-limit windows in migration v22", async () => {
    const client = new RecordingPostgresClient();
    requiredPlatformPostgresMigrationIds
      .filter(migrationId => migrationId !== "platform-auth-rate-limits-v22")
      .forEach(migrationId => client.appliedMigrationIds.add(migrationId));

    const result = await applyPlatformPostgresMigrations(client);

    expect(result.statementCount).toBeGreaterThan(0);
    expect(client.statements).toContainEqual(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS auth_rate_limit_windows"),
    );
    expect(client.statements).toContain("INSERT INTO platform_schema_migrations (id) VALUES ($1)");
  });

  it("stores historical public values and lets users import the same provider league independently", async () => {
    const client = new RecordingPostgresClient();
    requiredPlatformPostgresMigrationIds
      .filter(migrationId => migrationId !== "platform-historical-pricing-ownership-v9")
      .forEach(migrationId => client.appliedMigrationIds.add(migrationId));

    const result = await applyPlatformPostgresMigrations(client);

    expect(result.statementCount).toBeGreaterThan(0);
    expect(client.statements).toContain("DROP INDEX IF EXISTS leagues_provider_league_id_key;");
    expect(client.statements).toContain(
      "ALTER TABLE historical_draft_sales ADD COLUMN IF NOT EXISTS public_price_dollars integer;",
    );
    expect(client.statements).toContainEqual(
      expect.stringContaining("historical_draft_sales_public_price_check"),
    );
  });
});
