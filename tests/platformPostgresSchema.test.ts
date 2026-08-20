import { describe, expect, it } from "vitest";
import {
  platformPostgresMigrationStatements,
  platformPostgresSchema,
  type PostgresTableDefinition,
} from "../src/platform/postgresSchema.js";

const expectedTableOrder = [
  "accounts",
  "account_auth_tokens",
  "sessions",
  "auth_rate_limit_windows",
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
  "league_season_draft_setups",
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
  "draft_room_export_contents",
  "audit_events",
  "player_news_items",
  "fantasy_pros_rankings",
  "fantasy_pros_projections",
  "fantasy_pros_players",
  "fantasy_pros_fetch_log",
  "league_connections",
  "league_connection_snapshots",
  "provider_player_directories",
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

const expectColumn = (
  tableName: string,
  columnName: string,
  expected: Partial<{ type: string; nullable: boolean; default: string }> = {},
): void => {
  expect(tableByName(tableName).columns).toContainEqual(
    expect.objectContaining({
      name: columnName,
      ...expected,
    }),
  );
};

it("stores total revisions for connected-league sync claims and snapshots", () => {
  expectColumn("league_connections", "sync_revision", { type: "bigint", default: "0" });
  expectColumn("league_connection_snapshots", "sync_revision", {
    type: "bigint",
    default: "0",
  });
});

const expectCheckContract = (
  tableName: string,
  constraintName: string,
  expression: string,
): void => {
  expect(tableByName(tableName).checkConstraints ?? []).toContainEqual({
    name: constraintName,
    expression,
  });
};

const expectForeignKeyContract = (
  tableName: string,
  constraintName: string,
  columns: readonly string[],
  referencedTableName: string,
  referencedColumns: readonly string[],
): void => {
  expect(tableByName(tableName).foreignKeys ?? []).toContainEqual(
    expect.objectContaining({
      name: constraintName,
      columns,
      references: {
        table: referencedTableName,
        columns: referencedColumns,
      },
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
    expectUniqueContract("leagues", "leagues_slug_key", ["slug"]);
    expectUniqueContract("account_auth_tokens", "account_auth_tokens_token_hash_key", ["token_hash"]);
    expectUniqueContract("sessions", "sessions_token_hash_key", ["token_hash"]);
    expectUniqueContract("league_seasons", "league_seasons_league_year_key", ["league_id", "season_year"]);
    expectUniqueContract("league_memberships", "league_memberships_league_user_key", ["league_id", "user_id"]);
    expectUniqueContract("fantasy_teams", "fantasy_teams_season_owner_user_key", [
      "league_season_id",
      "owner_user_id",
    ], "owner_user_id IS NOT NULL");
    expectUniqueContract("historical_import_batches", "historical_import_batches_file_identity_key", [
      "league_id",
      "season_year",
      "file_hash",
    ], "superseded_by_batch_id IS NULL");
    expectUniqueContract("historical_import_batches", "historical_import_batches_current_committed_season_key", [
      "league_id",
      "season_year",
    ], "status = 'committed'");
    expectUniqueContract("model_runs", "model_runs_input_identity_key", [
      "league_season_id",
      "model_version",
      "input_hash",
    ]);
    expectUniqueContract("pricing_snapshots", "pricing_snapshots_snapshot_hash_key", ["snapshot_hash"]);
    expectUniqueContract("player_prices", "player_prices_snapshot_player_key", [
      "pricing_snapshot_id",
      "player_key",
    ]);
    expectUniqueContract("draft_rooms", "draft_rooms_real_season_key", [
      "league_season_id",
    ], "room_type = 'real'");
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
    expectUniqueContract("draft_room_export_contents", "draft_room_export_contents_artifact_key", [
      "artifact_id",
    ]);

    expect(tableByName("draft_rooms").primaryKey).toEqual(["id"]);
  });

  it("stores the structured fields only FantasyPros supplies on a news item", () => {
    // These columns arrive by ALTER on an existing table, so the schema and the
    // v16 migration have to agree on every one of them.
    expectColumn("player_news_items", "categories_json", { type: "jsonb", default: "'[]'::jsonb" });
    expectColumn("player_news_items", "analyst_impact", { type: "text", nullable: true });
    expectColumn("player_news_items", "provider_player_id", { type: "text", nullable: true });
    expectColumn("player_news_items", "provider_team_id", { type: "text", nullable: true });
    expectIndexContract(
      "player_news_items",
      "player_news_items_provider_player_id_idx",
      ["provider_player_id"],
    );
  });

  it("keeps encrypted ESPN credentials beside temporary rolling-deploy columns", () => {
    expectColumn("league_connections", "credentials_ciphertext", {
      type: "text",
      nullable: true,
    });
    expectColumn("league_connections", "credentials_key_id", {
      type: "text",
      nullable: true,
    });
    expectColumn("league_connections", "espn_s2", { type: "text", nullable: true });
    expectColumn("league_connections", "swid", { type: "text", nullable: true });
  });

  it("stores a stable public slug for clean league URLs", () => {
    expectColumn("leagues", "slug", { type: "text" });
    expectCheckContract("leagues", "leagues_slug_not_blank", "length(trim(slug)) > 0");
  });

  it("declares indexes used by common auth, private, job, and live-room reads", () => {
    expect(tableByName("account_auth_tokens").indexes).toContainEqual({
      name: "account_auth_tokens_account_purpose_idx",
      columns: ["account_id", "purpose"],
    });
    expectIndexContract("sessions", "sessions_account_id_idx", ["account_id"]);
    expectIndexContract("sessions", "sessions_expires_at_idx", ["expires_at"]);
    expectIndexContract("league_memberships", "league_memberships_user_status_idx", ["user_id", "status"]);
    expectIndexContract("jobs", "jobs_claimable_idx", ["status", "available_at", "created_at"]);
    expectIndexContract("jobs", "jobs_expired_lease_idx", ["status", "lock_expires_at"]);
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

  it("matches runtime records for imports, pricing, jobs, simulations, and exports", () => {
    expectColumn("accounts", "email", { type: "text" });
    expectColumn("accounts", "email_normalized", { type: "text" });
    expectColumn("accounts", "password_hash", { type: "text" });
    expectColumn("accounts", "status", {
      type: "text",
      default: "'active'",
    });
    expectCheckContract(
      "accounts",
      "accounts_status_check",
      "status IN ('active', 'disabled', 'deleted')",
    );

    expectColumn("sessions", "account_id", { type: "text" });
    expectColumn("sessions", "token_hash", { type: "text" });
    expectColumn("sessions", "expires_at", { type: "timestamptz" });
    expectColumn("sessions", "revoked_at", {
      type: "timestamptz",
      nullable: true,
    });
    expectColumn("sessions", "last_used_at", {
      type: "timestamptz",
      nullable: true,
    });
    expectForeignKeyContract("sessions", "sessions_account_id_fkey", ["account_id"], "accounts", ["id"]);

    expectColumn("roster_rule_sets", "draft_format", {
      type: "text",
      default: "'auction'",
    });
    expectColumn("roster_rule_sets", "budget", {
      type: "integer",
      nullable: true,
    });
    expectColumn("roster_rule_sets", "minimum_bid", {
      type: "integer",
      nullable: true,
    });
    expectColumn("roster_rule_sets", "snake_json", {
      type: "jsonb",
      nullable: true,
    });
    expectCheckContract(
      "roster_rule_sets",
      "roster_rule_sets_draft_format_check",
      "draft_format IN ('auction', 'snake')",
    );
    expectCheckContract(
      "roster_rule_sets",
      "roster_rule_sets_format_settings_check",
      "(draft_format = 'auction' AND budget IS NOT NULL AND minimum_bid IS NOT NULL AND budget > 0 AND minimum_bid > 0 AND snake_json IS NULL) OR (draft_format = 'snake' AND budget IS NULL AND minimum_bid IS NULL AND snake_json IS NOT NULL)",
    );

    expectColumn("historical_import_batches", "replacement_requested", {
      type: "boolean",
      default: "false",
    });
    expectColumn("historical_import_batches", "superseded_at", {
      type: "timestamptz",
      nullable: true,
    });

    expectColumn("historical_draft_sales", "owner_id", { type: "text" });
    expectColumn("historical_draft_sales", "owner_display_name", { type: "text" });
    expectColumn("historical_draft_sales", "player_name", { type: "text" });
    expectColumn("historical_draft_sales", "price_dollars", { type: "integer" });
    expectColumn("historical_draft_sales", "public_price_dollars", {
      type: "integer",
      nullable: true,
    });
    expectColumn("historical_draft_sales", "keeper", {
      type: "boolean",
      default: "false",
    });
    expectColumn("historical_draft_sales", "acquisition_type", { type: "text" });
    expectCheckContract(
      "historical_draft_sales",
      "historical_draft_sales_public_price_check",
      "public_price_dollars IS NULL OR public_price_dollars > 0",
    );
    expectCheckContract(
      "historical_draft_sales",
      "historical_draft_sales_acquisition_type_check",
      "acquisition_type IN ('auction', 'keeper')",
    );
    expect(uniqueContractsFor("leagues").map(contract => contract.name))
      .not.toContain("leagues_provider_league_id_key");

    expectColumn("player_prices", "player_id", {
      type: "text",
      nullable: true,
    });
    expectColumn("player_prices", "player_name", { type: "text" });
    expectColumn("player_prices", "normalized_name", { type: "text" });
    expectColumn("player_prices", "warnings_json", {
      type: "jsonb",
      default: "'[]'::jsonb",
    });
    expectColumn("player_prices", "confidence", {
      type: "numeric",
      nullable: true,
    });
    expectColumn("player_prices", "tier", {
      type: "text",
      nullable: true,
    });
    expectColumn("player_prices", "strategy_overlay_id", {
      type: "text",
      nullable: true,
    });

    expectColumn("jobs", "lock_expires_at", {
      type: "timestamptz",
      nullable: true,
    });
    expectColumn("jobs", "sanitized_error_json", {
      type: "jsonb",
      nullable: true,
    });

    expectColumn("simulation_runs", "request_json", {
      type: "jsonb",
      default: "'{}'::jsonb",
    });
    expectColumn("simulation_runs", "status", { type: "text" });
    expectColumn("simulation_runs", "started_at", {
      type: "timestamptz",
      nullable: true,
    });
    expectColumn("simulation_runs", "completed_at", {
      type: "timestamptz",
      nullable: true,
    });
    expectColumn("simulation_results", "summary_json", {
      type: "jsonb",
      default: "'{}'::jsonb",
    });
    expectColumn("simulation_results", "result_set_json", {
      type: "jsonb",
      default: "'{}'::jsonb",
    });
    expectCheckContract(
      "simulation_runs",
      "simulation_runs_status_check",
      "status IN ('requested', 'queued', 'running', 'completed', 'failed', 'canceled')",
    );

    expectColumn("draft_room_sales", "price", { type: "integer", nullable: true });
    expectColumn("draft_room_exports", "content_type", { type: "text" });
    expectColumn("draft_room_exports", "byte_length", { type: "integer" });
    expectColumn("draft_room_export_contents", "content_base64", { type: "text" });
    expectCheckContract(
      "draft_room_exports",
      "draft_room_exports_byte_length_check",
      "byte_length >= 0",
    );
  });

  it("emits Postgres-compatible SQL statements without needing a database connection", () => {
    const migrationSql = platformPostgresMigrationStatements.join("\n").toLowerCase();

    expect(platformPostgresMigrationStatements).toHaveLength(
      platformPostgresSchema.tables.length
        + platformPostgresSchema.tables.reduce((count, table) => count + (table.indexes?.length ?? 0), 0)
        + platformPostgresSchema.deferredForeignKeys.length,
    );
    expect(migrationSql).toContain("create table accounts");
    expect(migrationSql).toContain("create table auth_rate_limit_windows");
    expect(migrationSql).toContain("email_normalized text not null");
    expect(migrationSql).toContain("constraint accounts_email_normalized_key unique (email_normalized)");
    expect(migrationSql).toContain("create unique index mock_session_events_revision_idempotency_key");
    expect(migrationSql).toContain("where idempotency_key is not null");
    expect(migrationSql).toContain("jsonb");
    expect(migrationSql).toContain("timestamptz");
    expect(migrationSql).toContain("create table draft_room_export_contents");
    expect(migrationSql).toContain("lock_expires_at timestamptz");
    expect(migrationSql).toContain(
      "alter table league_seasons add constraint league_seasons_active_model_run_id_fkey",
    );
    expect(migrationSql).toContain(
      "alter table strategy_plans add constraint strategy_plans_current_version_id_fkey",
    );
  });
});
