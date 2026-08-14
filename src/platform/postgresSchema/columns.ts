import type { PostgresColumnDefinition } from "./types.js";

export const createdAtColumn: PostgresColumnDefinition = {
  name: "created_at",
  type: "timestamptz",
  default: "now()",
};

export const updatedAtColumn: PostgresColumnDefinition = {
  name: "updated_at",
  type: "timestamptz",
  default: "now()",
};

export const timestamps: readonly PostgresColumnDefinition[] = [
  createdAtColumn,
  updatedAtColumn,
];

export const jsonbDefault = "'{}'::jsonb";
export const jsonbArrayDefault = "'[]'::jsonb";
