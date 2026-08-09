import { describe, expect, it } from "vitest";
import {
  platformPostgresMigrationStatements,
  platformPostgresSchema,
  type PostgresTableDefinition,
} from "../src/platform/postgresSchema.js";

const expectedTableOrder = [
  "accounts",
  "sessions",
  "leagues",
  "league_memberships",
  "league_seasons",
  "fantasy_teams",
  "roster_rule_sets",
  "players",
  "player_aliases",
  "keeper_declarations",
  "historical_import_batches",
  "historical_draft_sales",
  "model_runs",
  "pricing_snapshots",
  "player_prices",
  "jobs",
  "strategy_plans",
  "strategy_plan_versions",
  "target_lists",
  "target_list_items",
  "private_notes",
  "coach_conversations",
  "coach_messages",
  "mock_sessions",
  "mock_session_events",
  "simulation_runs",
  "simulation_results",
  "draft_rooms",
  "draft_room_participants",
  "draft_room_events",
  "draft_room_sales",
  "draft_room_team_states",
  "draft_room_player_states",
  "draft_room_snapshots",
  "draft_room_exports",
  "audit_events",
] as const;

const tableByName = (tableName: string): PostgresTableDefinition => {
  const table = platformPostgresSchema.tables.find(candidate => candidate.name === tableName);

  if (table === undefined) {
    throw new Error(`Expected schema contract to include ${tableName}.`);
  }

  return table;
};

const uniqueContractsFor = (
  tableName: string,
): readonly { name: string; columns: readonly string[]; where?: string | undefined }[] => {
  const table = tableByName(tableName);

  return [
    ...(table.uniqueConstraints ?? []),
    ...(table.indexes ?? []).filter(index => index.unique),
  ];
};

const expectUniqueContract = (
  tableName: string,
  constraintName: string,
  columns: readonly string[],
  where?: string,
): void => {
  const contract = uniqueContractsFor(tableName).find(candidate => candidate.name === constraintName);

  expect(contract).toMatchObject({
    name: constraintName,
    columns,
    ...(where === undefined ? {} : { where }),
  });
};

const expectIndexContract = (
  tableName: string,
  indexName: string,
  columns: readonly string[],
): void => {
  expect(tableByName(tableName).indexes ?? []).toContainEqual(
    expect.objectContaining({
      name: indexName,
      columns,
    }),
  );
};

describe("platform Postgres schema contract", () => {
  it("covers the hosted platform production tables in migration order", () => {
    expect(platformPostgresSchema.tables.map(table => table.name)).toEqual(expectedTableOrder);
  });

  it("does not emit a table before its inline foreign-key dependencies", () => {
    const orderByTableName = new Map(
      platformPostgresSchema.tables.map((table, tableIndex) => [table.name, tableIndex]),
    );

    for (const table of platformPostgresSchema.tables) {
      const tableIndex = orderByTableName.get(table.name);

      if (tableIndex === undefined) {
        throw new Error(`Expected ${table.name} to have an order index.`);
      }

      for (const foreignKey of table.foreignKeys ?? []) {
        const dependencyIndex = orderByTableName.get(foreignKey.references.table);

        expect(dependencyIndex, `${table.name}.${foreignKey.name} references an unknown table`).toBeDefined();

        if (foreignKey.references.table !== table.name) {
          expect(
            dependencyIndex,
            `${table.name}.${foreignKey.name} must be emitted after ${foreignKey.references.table}`,
          ).toBeLessThan(tableIndex);
        }
      }
    }
  });

  it("emits deferred foreign keys after both dependent tables exist", () => {
    for (const foreignKey of platformPostgresSchema.deferredForeignKeys) {
      const sourceCreateIndex = platformPostgresMigrationStatements.findIndex(statement =>
        statement.startsWith(`CREATE TABLE ${foreignKey.table} (`),
      );
      const targetCreateIndex = platformPostgresMigrationStatements.findIndex(statement =>
        statement.startsWith(`CREATE TABLE ${foreignKey.references.table} (`),
      );
      const alterIndex = platformPostgresMigrationStatements.findIndex(statement =>
        statement.startsWith(`ALTER TABLE ${foreignKey.table} ADD CONSTRAINT ${foreignKey.name}`),
      );

      expect(sourceCreateIndex, `${foreignKey.name} source table is missing`).toBeGreaterThanOrEqual(0);
      expect(targetCreateIndex, `${foreignKey.name} target table is missing`).toBeGreaterThanOrEqual(0);
      expect(alterIndex, `${foreignKey.name} ALTER TABLE statement is missing`).toBeGreaterThan(
        Math.max(sourceCreateIndex, targetCreateIndex),
      );
    }
  });

  it("declares critical uniqueness and idempotency contracts", () => {
    expectUniqueContract("accounts", "accounts_email_normalized_key", ["email_normalized"]);
    expectUniqueContract("sessions", "sessions_token_hash_key", ["token_hash"]);
    expectUniqueContract("league_seasons", "league_seasons_league_year_key", ["league_id", "season_year"]);
    expectUniqueContract("league_memberships", "league_memberships_league_user_key", ["league_id", "user_id"]);
    expectUniqueContract("historical_import_batches", "historical_import_batches_file_identity_key", [
      "league_id",
      "season_year",
      "file_hash",
    ], "superseded_by_batch_id IS NULL");
    expectUniqueContract("model_runs", "model_runs_input_identity_key", [
      "league_season_id",
      "model_version",
      "input_hash",
    ]);
    expectUniqueContract("pricing_snapshots", "pricing_snapshots_snapshot_hash_key", ["snapshot_hash"]);
    expectUniqueContract("jobs", "jobs_user_league_season_idempotency_key", [
      "user_id",
      "league_id",
      "league_season_id",
      "idempotency_key",
    ]);
    expectUniqueContract("simulation_runs", "simulation_runs_user_league_season_idempotency_key", [
      "user_id",
      "league_id",
      "league_season_id",
      "idempotency_key",
    ]);
    expectUniqueContract("mock_session_events", "mock_session_events_revision_idempotency_key", [
      "mock_session_id",
      "revision",
      "idempotency_key",
    ], "idempotency_key IS NOT NULL");
    expectUniqueContract("draft_room_events", "draft_room_events_mutation_idempotency_key", [
      "draft_room_id",
      "idempotency_key",
    ], "idempotency_key IS NOT NULL");
    expectUniqueContract("draft_room_exports", "draft_room_exports_completed_revision_artifact_key", [
      "draft_room_id",
      "source_revision",
      "artifact_type",
    ], "status = 'completed'");

    expect(tableByName("draft_rooms").primaryKey).toEqual(["id"]);
  });

  it("declares indexes used by common auth, private, job, and live-room reads", () => {
    expectIndexContract("sessions", "sessions_account_id_idx", ["account_id"]);
    expectIndexContract("sessions", "sessions_expires_at_idx", ["expires_at"]);
    expectIndexContract("league_memberships", "league_memberships_user_status_idx", ["user_id", "status"]);
    expectIndexContract("jobs", "jobs_claimable_idx", ["status", "available_at", "created_at"]);
    expectIndexContract("strategy_plans", "strategy_plans_private_owner_idx", [
      "user_id",
      "league_season_id",
      "status",
    ]);
    expectIndexContract("mock_sessions", "mock_sessions_private_owner_idx", [
      "user_id",
      "league_season_id",
      "status",
    ]);
    expectIndexContract("simulation_runs", "simulation_runs_private_owner_idx", [
      "user_id",
      "league_season_id",
      "status",
    ]);
    expectIndexContract("draft_room_events", "draft_room_events_room_occurred_at_idx", [
      "draft_room_id",
      "occurred_at",
    ]);
  });

  it("emits Postgres-compatible SQL statements without needing a database connection", () => {
    const migrationSql = platformPostgresMigrationStatements.join("\n").toLowerCase();

    expect(platformPostgresMigrationStatements).toHaveLength(
      platformPostgresSchema.tables.length
        + platformPostgresSchema.tables.reduce((count, table) => count + (table.indexes?.length ?? 0), 0)
        + platformPostgresSchema.deferredForeignKeys.length,
    );
    expect(migrationSql).toContain("create table accounts");
    expect(migrationSql).toContain("email_normalized text not null");
    expect(migrationSql).toContain("constraint accounts_email_normalized_key unique (email_normalized)");
    expect(migrationSql).toContain("create unique index mock_session_events_revision_idempotency_key");
    expect(migrationSql).toContain("where idempotency_key is not null");
    expect(migrationSql).toContain("jsonb");
    expect(migrationSql).toContain("timestamptz");
    expect(migrationSql).toContain(
      "alter table league_seasons add constraint league_seasons_active_model_run_id_fkey",
    );
    expect(migrationSql).toContain(
      "alter table strategy_plans add constraint strategy_plans_current_version_id_fkey",
    );
  });
});
