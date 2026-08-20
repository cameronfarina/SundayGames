import { describe, expect, it } from "vitest";
import { PostgresAuthRateLimiter } from "../src/platform/postgresAuthRateLimit.js";
import type { PostgresTransactionalQueryClient } from "../src/platform/postgresJobQueue.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";
import { createPlatformAdmissions } from "../src/platform/platformServer/admissions.js";
import type { CreatePlatformServerOptions } from "../src/platform/platformServer/contracts.js";
import { mockRunner } from "./platformHttp/support/index.js";

interface StoredAttemptWindow {
  attemptCount: number;
  resetAt: Date;
  updatedAt: Date;
}

const rowKey = (scope: string, keyHash: string): string => `${scope}:${keyHash}`;

class AuthRateLimitDatabase {
  readonly rows = new Map<string, StoredAttemptWindow>();
  readonly statements: string[] = [];
  transactionTail: Promise<void> = Promise.resolve();
}

class AuthRateLimitClient implements PostgresTransactionalQueryClient {
  readonly #database: AuthRateLimitDatabase;

  constructor(database = new AuthRateLimitDatabase()) {
    this.#database = database;
  }

  get rows(): Map<string, StoredAttemptWindow> {
    return this.#database.rows;
  }

  get statements(): readonly string[] {
    return this.#database.statements;
  }

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    let release!: () => void;
    const precedingTransaction = this.#database.transactionTail;
    this.#database.transactionTail = new Promise(resolve => {
      release = resolve;
    });
    await precedingTransaction;
    try {
      return await operation(this);
    } finally {
      release();
    }
  }

  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<PostgresQueryResult<TRow>>;
  async query(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<unknown>> {
    const sql = text.replace(/\s+/gu, " ").trim();
    this.#database.statements.push(sql);
    if (sql.startsWith("SELECT pg_advisory_xact_lock")) return { rows: [] };
    if (sql.startsWith("DELETE FROM auth_rate_limit_windows") && sql.includes("LIMIT $3")) {
      const [scope, now, limit] = values as [string, Date, number];
      const expired = [...this.#database.rows.entries()]
        .filter(([key, row]) => key.startsWith(`${scope}:`) && row.resetAt <= now)
        .sort((left, right) => left[1].resetAt.getTime() - right[1].resetAt.getTime())
        .slice(0, limit);
      for (const [key] of expired) this.#database.rows.delete(key);
      return { rows: [], rowCount: expired.length };
    }
    if (sql.startsWith("SELECT attempt_count, reset_at FROM auth_rate_limit_windows")) {
      const key = rowKey(String(values[0]), String(values[1]));
      const row = this.#database.rows.get(key);
      return {
        rows: row === undefined ? [] : [{ attempt_count: row.attemptCount, reset_at: row.resetAt }],
      };
    }
    if (sql.startsWith("SELECT COUNT(*)")) {
      const [scope, now] = values as [string, Date];
      const active = [...this.#database.rows.entries()]
        .filter(([key, row]) => key.startsWith(`${scope}:`) && row.resetAt > now)
        .map(([, row]) => row);
      return {
        rows: [{
          tracked_count: String(active.length),
          earliest_reset_at: active.reduce<Date | null>(
            (earliest, row) => earliest === null || row.resetAt < earliest ? row.resetAt : earliest,
            null,
          ),
        }],
      };
    }
    if (sql.startsWith("INSERT INTO auth_rate_limit_windows")) {
      const [scope, keyHash, resetAt, updatedAt] = values as [string, string, Date, Date];
      this.#database.rows.set(rowKey(scope, keyHash), { attemptCount: 1, resetAt, updatedAt });
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("UPDATE auth_rate_limit_windows SET attempt_count = 1")) {
      const [scope, keyHash, resetAt, updatedAt] = values as [string, string, Date, Date];
      this.#database.rows.set(rowKey(scope, keyHash), { attemptCount: 1, resetAt, updatedAt });
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("UPDATE auth_rate_limit_windows SET attempt_count = attempt_count + 1")) {
      const [scope, keyHash, updatedAt] = values as [string, string, Date];
      const row = this.#database.rows.get(rowKey(scope, keyHash));
      if (row === undefined) throw new Error("Expected an existing rate-limit row.");
      row.attemptCount += 1;
      row.updatedAt = updatedAt;
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("DELETE FROM auth_rate_limit_windows WHERE scope = $1 AND key_hash = $2")) {
      const deleted = this.#database.rows.delete(rowKey(String(values[0]), String(values[1])));
      return { rows: [], rowCount: deleted ? 1 : 0 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  }
}

const limiter = (
  client: PostgresTransactionalQueryClient,
  overrides: Partial<ConstructorParameters<typeof PostgresAuthRateLimiter>[1]> = {},
): PostgresAuthRateLimiter => new PostgresAuthRateLimiter(client, {
  scope: "login-client",
  maxAttempts: 2,
  windowMs: 60_000,
  maxTrackedKeys: 100,
  cleanupBatchSize: 10,
  normalizeKey: value => value.trim().toLowerCase(),
  ...overrides,
});

const now = new Date("2026-08-20T12:00:00.000Z");

describe("Postgres auth rate limiter", () => {
  it("uses shared Postgres state for the default admission limiters of two servers", async () => {
    const database = new AuthRateLimitDatabase();
    const firstServerOptions: CreatePlatformServerOptions = {
      postgresClient: new AuthRateLimitClient(database),
      simulationRunner: mockRunner,
    };
    const secondServerOptions: CreatePlatformServerOptions = {
      postgresClient: new AuthRateLimitClient(database),
      simulationRunner: mockRunner,
    };
    const firstServer = createPlatformAdmissions(firstServerOptions);
    const secondServer = createPlatformAdmissions(secondServerOptions);

    const decisions = await Promise.all([
      firstServer.loginRateLimiter.consume("198.51.100.20", now),
      secondServer.loginRateLimiter.consume("198.51.100.20", now),
      firstServer.loginRateLimiter.consume("198.51.100.20", now),
      secondServer.loginRateLimiter.consume("198.51.100.20", now),
      firstServer.loginRateLimiter.consume("198.51.100.20", now),
    ]);
    expect(decisions.every(decision => decision.allowed)).toBe(true);
    await expect(secondServer.loginRateLimiter.consume("198.51.100.20", now)).resolves.toMatchObject({
      allowed: false,
      retryAfterMs: 15 * 60 * 1_000,
    });
  });

  it("shares attempts across limiter instances", async () => {
    const database = new AuthRateLimitDatabase();
    const firstServerLimiter = limiter(new AuthRateLimitClient(database));
    const secondServerLimiter = limiter(new AuthRateLimitClient(database));

    await expect(firstServerLimiter.consume(" 198.51.100.10 ", now)).resolves.toEqual({
      allowed: true,
      remainingAttempts: 1,
      retryAfterMs: 0,
    });
    await expect(secondServerLimiter.consume("198.51.100.10", now)).resolves.toEqual({
      allowed: true,
      remainingAttempts: 0,
      retryAfterMs: 0,
    });
    await expect(firstServerLimiter.consume("198.51.100.10", now)).resolves.toEqual({
      allowed: false,
      remainingAttempts: 0,
      retryAfterMs: 60_000,
    });
  });

  it("expires windows and cleans only a bounded batch while admitting a new key", async () => {
    const client = new AuthRateLimitClient();
    const rateLimiter = limiter(client, {
      maxAttempts: 1,
      windowMs: 1_000,
      maxTrackedKeys: 2,
      cleanupBatchSize: 1,
    });

    await rateLimiter.consume("198.51.100.1", now);
    await rateLimiter.consume("198.51.100.2", new Date(now.getTime() + 500));
    await expect(rateLimiter.consume("198.51.100.3", new Date(now.getTime() + 1_000))).resolves.toEqual({
      allowed: true,
      remainingAttempts: 0,
      retryAfterMs: 0,
    });

    expect(client.rows).toHaveLength(2);
    expect(client.statements.filter(statement => statement.includes("LIMIT $3"))).toHaveLength(3);
  });

  it("admits no more than the configured maximum under concurrent attempts", async () => {
    const client = new AuthRateLimitClient();
    const rateLimiter = limiter(client, { maxAttempts: 3 });

    const decisions = await Promise.all(Array.from(
      { length: 20 },
      () => rateLimiter.consume("203.0.113.10", now),
    ));

    expect(decisions.filter(decision => decision.allowed)).toHaveLength(3);
    expect(decisions.filter(decision => !decision.allowed)).toHaveLength(17);
  });

  it("resets only the matching scope and normalized key", async () => {
    const client = new AuthRateLimitClient();
    const loginLimiter = limiter(client);
    const signupLimiter = limiter(client, { scope: "signup-email" });
    await loginLimiter.consume("198.51.100.10", now);
    await signupLimiter.consume("198.51.100.10", now);

    await loginLimiter.reset(" 198.51.100.10 ");

    await expect(loginLimiter.consume("198.51.100.10", now)).resolves.toMatchObject({
      allowed: true,
      remainingAttempts: 1,
    });
    await expect(signupLimiter.consume("198.51.100.10", now)).resolves.toMatchObject({
      allowed: true,
      remainingAttempts: 0,
    });
  });
});
