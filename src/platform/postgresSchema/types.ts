export interface PostgresColumnDefinition {
  name: string;
  type: string;
  nullable?: boolean;
  default?: string;
}

export interface PostgresNamedColumnConstraint {
  name: string;
  columns: readonly string[];
}

export interface PostgresCheckConstraintDefinition {
  name: string;
  expression: string;
}

export type PostgresReferentialAction = "CASCADE" | "RESTRICT" | "SET NULL" | "NO ACTION";

export interface PostgresForeignKeyDefinition extends PostgresNamedColumnConstraint {
  references: {
    table: string;
    columns: readonly string[];
  };
  onDelete?: PostgresReferentialAction;
}

export interface PostgresIndexDefinition extends PostgresNamedColumnConstraint {
  unique?: boolean;
  where?: string;
  using?: string;
}

export interface PostgresTableDefinition {
  name: string;
  columns: readonly PostgresColumnDefinition[];
  primaryKey: readonly string[];
  uniqueConstraints?: readonly PostgresNamedColumnConstraint[];
  checkConstraints?: readonly PostgresCheckConstraintDefinition[];
  foreignKeys?: readonly PostgresForeignKeyDefinition[];
  indexes?: readonly PostgresIndexDefinition[];
}

export interface PostgresDeferredForeignKeyDefinition extends PostgresForeignKeyDefinition {
  table: string;
}

export interface PostgresSchemaContract {
  tables: readonly PostgresTableDefinition[];
  deferredForeignKeys: readonly PostgresDeferredForeignKeyDefinition[];
  statements: readonly string[];
}
