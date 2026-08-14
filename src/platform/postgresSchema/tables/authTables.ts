import { createdAtColumn, timestamps } from "../columns.js";
import type { PostgresTableDefinition } from "../types.js";

export const authTables: readonly PostgresTableDefinition[] = [
  {
    name: "accounts",
    columns: [
      { name: "id", type: "text" },
      { name: "email", type: "text" },
      { name: "email_normalized", type: "text" },
      { name: "password_hash", type: "text" },
      { name: "email_verified_at", type: "timestamptz", nullable: true },
      { name: "auth_version", type: "bigint", default: "1" },
      { name: "display_name", type: "text", nullable: true },
      { name: "status", type: "text", default: "'active'" },
      ...timestamps,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "accounts_email_normalized_key", columns: ["email_normalized"] },
    ],
    checkConstraints: [
      { name: "accounts_email_normalized_not_blank", expression: "length(trim(email_normalized)) > 0" },
      { name: "accounts_status_check", expression: "status IN ('active', 'disabled', 'deleted')" },
    ],
  },
  {
    name: "account_auth_tokens",
    columns: [
      { name: "id", type: "text" },
      { name: "account_id", type: "text" },
      { name: "purpose", type: "text" },
      { name: "token_hash", type: "text" },
      { name: "auth_version", type: "bigint", default: "1" },
      { name: "expires_at", type: "timestamptz" },
      { name: "consumed_at", type: "timestamptz", nullable: true },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "account_auth_tokens_token_hash_key", columns: ["token_hash"] },
    ],
    checkConstraints: [
      { name: "account_auth_tokens_purpose_check", expression: "purpose IN ('email_verification', 'password_reset')" },
      { name: "account_auth_tokens_expiry_check", expression: "expires_at > created_at" },
    ],
    foreignKeys: [
      {
        name: "account_auth_tokens_account_id_fkey",
        columns: ["account_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
    indexes: [
      { name: "account_auth_tokens_account_purpose_idx", columns: ["account_id", "purpose"] },
      { name: "account_auth_tokens_expires_at_idx", columns: ["expires_at"] },
    ],
  },
  {
    name: "sessions",
    columns: [
      { name: "id", type: "text" },
      { name: "account_id", type: "text" },
      { name: "token_hash", type: "text" },
      { name: "auth_version", type: "bigint", default: "1" },
      { name: "expires_at", type: "timestamptz" },
      { name: "revoked_at", type: "timestamptz", nullable: true },
      { name: "last_used_at", type: "timestamptz", nullable: true },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "sessions_token_hash_key", columns: ["token_hash"] },
    ],
    foreignKeys: [
      {
        name: "sessions_account_id_fkey",
        columns: ["account_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
    indexes: [
      { name: "sessions_account_id_idx", columns: ["account_id"] },
      { name: "sessions_expires_at_idx", columns: ["expires_at"] },
    ],
  },
];
