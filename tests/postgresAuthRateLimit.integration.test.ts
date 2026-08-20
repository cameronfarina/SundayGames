import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createNodePostgresClient,
  type NodePostgresClient,
} from "../src/platform/postgresClient.js";
import { PostgresAuthRateLimiter } from "../src/platform/postgresAuthRateLimit.js";
import { applyPlatformPostgresMigrations } from "../src/platform/platformMigrations.js";

const databaseUrl = process.env.MOCKD_POSTGRES_INTEGRATION_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl === undefined || databaseUrl.length === 0
  ? describe.skip
  : describe;
const now = new Date("2026-08-20T12:00:00.000Z");
const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;

describeWithPostgres("Postgres authentication rate limits", () => {
  let adminClient: NodePostgresClient;
  let firstClient: NodePostgresClient;
  let secondClient: NodePostgresClient;
  let schemaName: string;

  beforeAll(async () => {
    if (databaseUrl === undefined || databaseUrl.length === 0) {
      throw new Error("MOCKD_POSTGRES_INTEGRATION_DATABASE_URL is required.");
    }
    schemaName = `mockd_auth_rate_limit_${randomUUID().replaceAll("-", "")}`;
    adminClient = createNodePostgresClient({ databaseUrl, max: 1 });
    await adminClient.query(`CREATE SCHEMA ${quoteIdentifier(schemaName)}`);
    const isolatedUrl = new URL(databaseUrl);
    isolatedUrl.searchParams.set("options", `-c search_path=${schemaName}`);
    firstClient = createNodePostgresClient({ databaseUrl: isolatedUrl.toString(), max: 10 });
    secondClient = createNodePostgresClient({ databaseUrl: isolatedUrl.toString(), max: 10 });
    await applyPlatformPostgresMigrations(firstClient);
  }, 30_000);

  afterAll(async () => {
    await firstClient?.close();
    await secondClient?.close();
    if (adminClient !== undefined && schemaName !== undefined) {
      await adminClient.query(`DROP SCHEMA ${quoteIdentifier(schemaName)} CASCADE`);
    }
    await adminClient?.close();
  });

  it("shares one atomic fixed window across processes and expires it", async () => {
    const options = {
      scope: "integration-login-client",
      maxAttempts: 3,
      windowMs: 1_000,
      maxTrackedKeys: 100,
      cleanupBatchSize: 10,
      normalizeKey: (value: string) => value.trim().toLowerCase(),
    };
    const firstLimiter = new PostgresAuthRateLimiter(firstClient, options);
    const secondLimiter = new PostgresAuthRateLimiter(secondClient, options);

    const decisions = await Promise.all(Array.from(
      { length: 20 },
      (_, index) => (index % 2 === 0 ? firstLimiter : secondLimiter)
        .consume("198.51.100.30", now),
    ));
    expect(decisions.filter(decision => decision.allowed)).toHaveLength(3);
    expect(decisions.filter(decision => !decision.allowed)).toHaveLength(17);

    await expect(firstLimiter.consume(
      "198.51.100.30",
      new Date(now.getTime() + 1_000),
    )).resolves.toMatchObject({ allowed: true, remainingAttempts: 2 });
  }, 30_000);
});
