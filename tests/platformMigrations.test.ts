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
    ].forEach(migrationId => client.appliedMigrationIds.add(migrationId));

    await expect(applyPlatformPostgresMigrations(client)).resolves.toEqual({ statementCount: 4 });
    expect(client.statements).toContain(
      "ALTER TABLE fantasy_teams ADD COLUMN IF NOT EXISTS abbreviation text;",
    );
    expect(client.statements).toContain(
      "ALTER TABLE fantasy_teams ADD COLUMN IF NOT EXISTS manager_names_json jsonb NOT NULL DEFAULT '[]'::jsonb;",
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
    ]);
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
