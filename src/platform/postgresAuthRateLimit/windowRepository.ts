import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";

export interface AttemptWindowRow {
  attempt_count: number | string;
  reset_at: Date | string;
}

export interface CapacityRow {
  tracked_count: number | string;
  earliest_reset_at: Date | string | null;
}

const lockNamespace = "sunday-games:auth-rate-limit";

export class PostgresAuthRateLimitWindowRepository {
  readonly #client: PostgresQueryClient;
  readonly #scope: string;
  readonly #transactionClient: PostgresTransactionalQueryClient | undefined;

  constructor(
    client: PostgresQueryClient,
    scope: string,
    transactionClient?: PostgresTransactionalQueryClient,
  ) {
    this.#client = client;
    this.#scope = scope;
    this.#transactionClient = transactionClient;
  }

  async transaction<T>(
    keyHash: string,
    operation: (repository: PostgresAuthRateLimitWindowRepository) => Promise<T>,
  ): Promise<T> {
    if (this.#transactionClient === undefined) {
      throw new Error("A transaction client is required for auth rate-limit mutations.");
    }
    return await this.#transactionClient.transaction(async client => {
      const repository = new PostgresAuthRateLimitWindowRepository(client, this.#scope);
      await repository.#lock(`${this.#scope}:${keyHash}`);
      return await operation(repository);
    });
  }

  async lockCapacity(): Promise<void> {
    await this.#lock(`${this.#scope}:capacity`);
  }

  async deleteExpired(now: Date, batchSize: number): Promise<void> {
    await this.#client.query(
      `DELETE FROM auth_rate_limit_windows
       WHERE scope = $1 AND key_hash IN (
         SELECT key_hash
         FROM auth_rate_limit_windows
         WHERE scope = $1 AND reset_at <= $2
         ORDER BY reset_at, key_hash
         LIMIT $3
       )`,
      [this.#scope, now, batchSize],
    );
  }

  async find(keyHash: string): Promise<AttemptWindowRow | undefined> {
    const result = await this.#client.query<AttemptWindowRow>(
      `SELECT attempt_count, reset_at FROM auth_rate_limit_windows
       WHERE scope = $1 AND key_hash = $2`,
      [this.#scope, keyHash],
    );
    return result.rows[0];
  }

  async capacity(now: Date): Promise<CapacityRow> {
    const result = await this.#client.query<CapacityRow>(
      `SELECT COUNT(*) AS tracked_count, MIN(reset_at) AS earliest_reset_at
       FROM auth_rate_limit_windows
       WHERE scope = $1 AND reset_at > $2`,
      [this.#scope, now],
    );
    const capacity = result.rows[0];
    if (capacity === undefined) throw new Error("Postgres did not return auth rate-limit capacity.");
    return capacity;
  }

  async increment(keyHash: string, now: Date): Promise<void> {
    await this.#client.query(
      `UPDATE auth_rate_limit_windows
          SET attempt_count = attempt_count + 1, updated_at = $3
        WHERE scope = $1 AND key_hash = $2`,
      [this.#scope, keyHash, now],
    );
  }

  async replace(keyHash: string, resetAt: Date, now: Date): Promise<void> {
    await this.#client.query(
      `UPDATE auth_rate_limit_windows
          SET attempt_count = 1, reset_at = $3, updated_at = $4
        WHERE scope = $1 AND key_hash = $2`,
      [this.#scope, keyHash, resetAt, now],
    );
  }

  async insert(keyHash: string, resetAt: Date, now: Date): Promise<void> {
    await this.#client.query(
      `INSERT INTO auth_rate_limit_windows
        (scope, key_hash, attempt_count, reset_at, updated_at)
       VALUES ($1, $2, 1, $3, $4)`,
      [this.#scope, keyHash, resetAt, now],
    );
  }

  async delete(keyHash: string): Promise<void> {
    await this.#client.query(
      "DELETE FROM auth_rate_limit_windows WHERE scope = $1 AND key_hash = $2",
      [this.#scope, keyHash],
    );
  }

  async #lock(key: string): Promise<void> {
    await this.#client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`${lockNamespace}:${key}`],
    );
  }
}
