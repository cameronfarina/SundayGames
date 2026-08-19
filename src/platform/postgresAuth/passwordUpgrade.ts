import type { AccountCredentialRecord, UpgradePasswordHashInput } from "../auth.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { accountCredentialFromRow, firstRow } from "./mappers.js";
import type { AccountRow } from "./rows.js";

export const upgradePasswordHash = async (
  client: PostgresQueryClient,
  input: UpgradePasswordHashInput,
): Promise<AccountCredentialRecord | null> => {
  const result = await client.query<AccountRow>(
    `
UPDATE accounts
SET password_hash = $3, updated_at = $4
WHERE id = $1
  AND status = 'active'
  AND password_hash = $2
RETURNING id, email, display_name, password_hash, email_verified_at, status, created_at, updated_at;
`.trim(),
    [input.accountId, input.expectedPasswordHash, input.passwordHash, input.now],
  );
  const row = firstRow(result);
  return row === undefined ? null : accountCredentialFromRow(row);
};
