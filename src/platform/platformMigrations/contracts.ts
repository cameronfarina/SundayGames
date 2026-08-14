import type { PostgresQueryClient } from "../postgresPlatformStore.js";

export interface ApplyPlatformPostgresMigrationsResult {
  statementCount: number;
}

export interface AppliedMigrationRow {
  id: string;
}

export interface DuplicateRealDraftRoomsRow {
  league_season_id: string;
  room_ids: string[];
}

export interface PlatformSchemaMigration {
  id: string;
  statements: readonly string[];
  preflight?: (client: PostgresQueryClient) => Promise<void>;
}
