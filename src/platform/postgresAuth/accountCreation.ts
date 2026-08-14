import {
  AuthError,
  type AccountRecord,
  type CreateAccountRecordInput,
  type CreateOrReplacePendingAccountInput,
  type PendingAccountRegistrationResult,
} from "../auth.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { findAccountCredentialByEmail } from "./accountQueries.js";
import { accountFromRow, credentialVersionFromDb, firstRow } from "./mappers.js";
import type { AccountRow, PendingAccountRow } from "./rows.js";

export const createAccount = async (
  client: PostgresQueryClient,
  input: CreateAccountRecordInput,
): Promise<AccountRecord> => {
  const result = await client.query<AccountRow>(
    `
INSERT INTO accounts (
  id,
  email,
  email_normalized,
  password_hash,
  email_verified_at,
  created_at,
  updated_at
) VALUES ($1, $2, $2, $3, $4, $5, $5)
ON CONFLICT ON CONSTRAINT accounts_email_normalized_key DO NOTHING
RETURNING id, email, password_hash, email_verified_at, status, created_at, updated_at;
`.trim(),
    [input.id, input.email, input.passwordHash, input.emailVerifiedAt ?? input.now, input.now],
  );
  const row = firstRow(result);
  if (row === undefined) {
    throw new AuthError("duplicate_email", "An account with this email already exists.");
  }
  return accountFromRow(row);
};

export const createOrReplacePendingAccount = async (
  client: PostgresQueryClient,
  input: CreateOrReplacePendingAccountInput,
): Promise<PendingAccountRegistrationResult> => {
  const result = await client.query<PendingAccountRow>(
    `
INSERT INTO accounts (
  id, email, email_normalized, password_hash, email_verified_at, created_at, updated_at
) VALUES ($1, $2, $2, $3, NULL, $4, $4)
ON CONFLICT ON CONSTRAINT accounts_email_normalized_key DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    auth_version = accounts.auth_version + 1,
    updated_at = EXCLUDED.updated_at
WHERE accounts.email_verified_at IS NULL
RETURNING id, email, password_hash, email_verified_at, auth_version, status, created_at, updated_at,
  (xmax = 0) AS was_inserted;
`.trim(),
    [input.id, input.email, input.passwordHash, input.now],
  );
  const row = firstRow(result);
  if (row !== undefined) {
    return {
      account: accountFromRow(row),
      status: row.was_inserted ? "created" : "reissued",
      credentialVersion: credentialVersionFromDb(row.auth_version),
    };
  }
  const existing = await findAccountCredentialByEmail(client, input.email);
  if (existing === null) throw new Error("Postgres pending account upsert did not return an account.");
  return { account: existing.account, status: "verified" };
};
