import type {
  PostgresColumnDefinition,
  PostgresDeferredForeignKeyDefinition,
  PostgresForeignKeyDefinition,
  PostgresIndexDefinition,
  PostgresTableDefinition,
} from "./types.js";

const renderColumns = (columns: readonly string[]): string => columns.join(", ");

const renderColumnDefinition = (column: PostgresColumnDefinition): string => [
  column.name,
  column.type,
  column.default === undefined ? undefined : `DEFAULT ${column.default}`,
  column.nullable === true ? undefined : "NOT NULL",
].filter((part): part is string => part !== undefined).join(" ");

const renderForeignKeyConstraint = (foreignKey: PostgresForeignKeyDefinition): string => [
  `CONSTRAINT ${foreignKey.name}`,
  `FOREIGN KEY (${renderColumns(foreignKey.columns)})`,
  `REFERENCES ${foreignKey.references.table} (${renderColumns(foreignKey.references.columns)})`,
  foreignKey.onDelete === undefined ? undefined : `ON DELETE ${foreignKey.onDelete}`,
].filter((part): part is string => part !== undefined).join(" ");

const renderCreateTableStatement = (table: PostgresTableDefinition): string => {
  const tableConstraints = [
    `CONSTRAINT ${table.name}_pkey PRIMARY KEY (${renderColumns(table.primaryKey)})`,
    ...(table.uniqueConstraints ?? []).map(
      constraint => `CONSTRAINT ${constraint.name} UNIQUE (${renderColumns(constraint.columns)})`,
    ),
    ...(table.checkConstraints ?? []).map(
      constraint => `CONSTRAINT ${constraint.name} CHECK (${constraint.expression})`,
    ),
    ...(table.foreignKeys ?? []).map(renderForeignKeyConstraint),
  ];
  const createBody = [
    ...table.columns.map(renderColumnDefinition),
    ...tableConstraints,
  ].map(line => `  ${line}`).join(",\n");

  return `CREATE TABLE ${table.name} (\n${createBody}\n);`;
};

const renderIndexStatement = (
  tableName: string,
  index: PostgresIndexDefinition,
): string => [
  `CREATE ${index.unique === true ? "UNIQUE " : ""}INDEX ${index.name}`,
  `ON ${tableName}`,
  index.using === undefined ? undefined : `USING ${index.using}`,
  `(${renderColumns(index.columns)})`,
  index.where === undefined ? undefined : `WHERE ${index.where}`,
].filter((part): part is string => part !== undefined).join(" ") + ";";

const renderDeferredForeignKeyStatement = (
  foreignKey: PostgresDeferredForeignKeyDefinition,
): string =>
  `ALTER TABLE ${foreignKey.table} ADD ${renderForeignKeyConstraint(foreignKey)};`;

export const renderMigrationStatements = (
  tables: readonly PostgresTableDefinition[],
  deferredForeignKeys: readonly PostgresDeferredForeignKeyDefinition[],
): readonly string[] => [
  ...tables.map(renderCreateTableStatement),
  ...tables.flatMap(table => (table.indexes ?? []).map(index => renderIndexStatement(table.name, index))),
  ...deferredForeignKeys.map(renderDeferredForeignKeyStatement),
];
