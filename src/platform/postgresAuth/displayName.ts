import type { AccountRecord, ReplaceDisplayNameInput } from "../auth.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { accountFromRow, firstRow } from "./mappers.js";
import type { AccountRow } from "./rows.js";

export const replaceDisplayName = async (
  client: PostgresQueryClient,
  input: ReplaceDisplayNameInput,
): Promise<AccountRecord | null> => {
  const result = await client.query<AccountRow>(
    `
UPDATE accounts
SET display_name = $2, updated_at = $3
WHERE id = $1
  AND status = 'active'
RETURNING id, email, display_name, password_hash, email_verified_at, status, created_at, updated_at;
`.trim(),
    [input.accountId, input.displayName ?? null, input.now],
  );
  const row = firstRow(result);
  return row === undefined ? null : accountFromRow(row);
};
