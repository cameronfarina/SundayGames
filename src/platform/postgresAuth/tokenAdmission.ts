import type {
  AuthTokenFinalizer,
  FindUsableAuthTokenInput,
} from "../auth.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { firstRow } from "./mappers.js";
import { supportsTransactions } from "./transactions.js";

type FinalizerFactory = (client: PostgresQueryClient) => AuthTokenFinalizer;

export const withAuthTokenAdmission = async <TResult>(
  client: PostgresQueryClient,
  input: FindUsableAuthTokenInput,
  createFinalizer: FinalizerFactory,
  operation: (finalizer: AuthTokenFinalizer) => Promise<TResult>,
): Promise<TResult | null> => {
  if (!supportsTransactions(client)) {
    throw new Error("Postgres authentication token admission requires transactions.");
  }
  return await client.transaction(async transactionClient => {
    const result = await transactionClient.query<{ usable: boolean }>(
      `
SELECT TRUE AS usable
FROM account_auth_tokens
JOIN accounts ON accounts.id = account_auth_tokens.account_id
  AND accounts.auth_version = account_auth_tokens.auth_version
WHERE account_auth_tokens.token_hash = $1
  AND account_auth_tokens.purpose = $2
  AND account_auth_tokens.consumed_at IS NULL
  AND account_auth_tokens.expires_at > $3
  AND accounts.status = 'active'
  AND (($2 = 'email_verification' AND accounts.email_verified_at IS NULL)
    OR ($2 = 'password_reset' AND accounts.email_verified_at IS NOT NULL))
LIMIT 1
FOR UPDATE OF account_auth_tokens SKIP LOCKED;
`.trim(),
      [input.tokenHash, input.purpose, input.now],
    );
    if (firstRow(result)?.usable !== true) return null;
    return await operation(createFinalizer(transactionClient));
  });
};
