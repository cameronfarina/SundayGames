import { platformPostgresDeferredForeignKeys } from "./deferredForeignKeys.js";
import { renderMigrationStatements } from "./renderMigrationStatements.js";
import { platformPostgresTables } from "./tables/index.js";
import type { PostgresSchemaContract } from "./types.js";

export const platformPostgresMigrationStatements = renderMigrationStatements(
  platformPostgresTables,
  platformPostgresDeferredForeignKeys,
);

export const platformPostgresSchema: PostgresSchemaContract = {
  tables: platformPostgresTables,
  deferredForeignKeys: platformPostgresDeferredForeignKeys,
  statements: platformPostgresMigrationStatements,
};
