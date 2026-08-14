import type { PostgresQueryClient } from "../postgresPlatformStore.js";

export interface TransactionalPostgresAuthClient extends PostgresQueryClient {
  transaction<TResult>(
    operation: (client: PostgresQueryClient) => Promise<TResult>,
  ): Promise<TResult>;
}

export const supportsTransactions = (
  client: PostgresQueryClient,
): client is TransactionalPostgresAuthClient =>
  "transaction" in client && typeof client.transaction === "function";
