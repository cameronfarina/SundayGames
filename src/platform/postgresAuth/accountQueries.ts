import type { AccountCredentialRecord, AccountRecord } from "../auth.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { accountCredentialFromRow, accountFromRow, firstRow } from "./mappers.js";
import type { AccountRow } from "./rows.js";

const selectAccountSql = `
SELECT id, email, password_hash, email_verified_at, status, created_at, updated_at
FROM accounts
`.trim();

export const findAccountCredentialByEmail = async (
  client: PostgresQueryClient,
  normalizedEmail: string,
): Promise<AccountCredentialRecord | null> => {
  const result = await client.query<AccountRow>(
    `${selectAccountSql} WHERE email_normalized = $1 AND status = 'active'`,
    [normalizedEmail],
  );
  const row = firstRow(result);
  return row === undefined ? null : accountCredentialFromRow(row);
};

export const findAccountById = async (
  client: PostgresQueryClient,
  accountId: string,
): Promise<AccountRecord | null> => {
  const result = await client.query<AccountRow>(
    `${selectAccountSql} WHERE id = $1 AND status = 'active'`,
    [accountId],
  );
  const row = firstRow(result);
  return row === undefined ? null : accountFromRow(row);
};
