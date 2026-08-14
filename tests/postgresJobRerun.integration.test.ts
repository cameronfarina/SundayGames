import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { maximumRetainedTerminalJobsPerUser } from "../src/platform/jobHistory.js";
import { JobError } from "../src/platform/jobs.js";
import { applyPlatformPostgresMigrations } from "../src/platform/platformMigrations.js";
import { createNodePostgresClient, type NodePostgresClient } from "../src/platform/postgresClient.js";
import { PostgresJobQueue } from "../src/platform/postgresJobQueue.js";

const databaseUrl = process.env.MOCKD_POSTGRES_INTEGRATION_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl === undefined || databaseUrl.length === 0
  ? describe.skip
  : describe;

const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;

describeWithPostgres("Postgres simulation rerun admission", () => {
  let adminClient: NodePostgresClient;
  let client: NodePostgresClient;
  let schemaName: string;

  beforeAll(async () => {
    if (databaseUrl === undefined || databaseUrl.length === 0) {
      throw new Error("MOCKD_POSTGRES_INTEGRATION_DATABASE_URL is required.");
    }
    schemaName = `mockd_job_rerun_${randomUUID().replaceAll("-", "")}`;
    adminClient = createNodePostgresClient({ databaseUrl, max: 1 });
    await adminClient.query(`CREATE SCHEMA ${quoteIdentifier(schemaName)}`);
    const isolatedUrl = new URL(databaseUrl);
    isolatedUrl.searchParams.set("options", `-c search_path=${schemaName}`);
    client = createNodePostgresClient({ databaseUrl: isolatedUrl.toString(), max: 110 });
    await applyPlatformPostgresMigrations(client);
    await client.query(
      "INSERT INTO accounts (id, email, email_normalized, password_hash) VALUES ('user_owner11', 'owner11@example.com', 'owner11@example.com', 'hash')",
    );
    await client.query(
      "INSERT INTO leagues (id, name, created_by_user_id) VALUES ('league_100001', 'Test League', 'user_owner11')",
    );
    await client.query(
      "INSERT INTO league_seasons (id, league_id, season_year, name) VALUES ('season_2026', 'league_100001', 2026, '2026')",
    );
  }, 30_000);

  afterAll(async () => {
    await client?.close();
    if (adminClient !== undefined && schemaName !== undefined) {
      await adminClient.query(`DROP SCHEMA ${quoteIdentifier(schemaName)} CASCADE`);
    }
    await adminClient?.close();
  });

  it("admits one row across concurrent distinct-key reruns and reuses it later", async () => {
    const queue = new PostgresJobQueue(client);
    const original = await queue.submit({
      userId: "user_owner11",
      leagueId: "league_100001",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: {
        type: "simulation-run-execution",
        simulationRunId: "sim_owner11_strategy",
        runCount: 25,
      },
      idempotencyKey: "simulation-run-execution:sim_owner11_strategy",
    });
    await queue.cancelJob({ jobId: original.id, userId: original.userId });

    const outcomes = await Promise.allSettled(Array.from(
      { length: 100 },
      (_, index) => queue.rerunJob({
        jobId: original.id,
        userId: original.userId,
        idempotencyKey: `attacker-key-${index}`,
      }),
    ));
    const accepted = outcomes.filter(outcome => outcome.status === "fulfilled");
    const rejected = outcomes.filter(outcome => outcome.status === "rejected");

    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(99);
    for (const outcome of rejected) {
      expect(outcome.reason).toEqual(new JobError(
        "job_already_active",
        "A rerun is already queued or running for this simulation.",
      ));
    }
    const acceptedJob = accepted[0]?.value;
    if (acceptedJob === undefined) throw new Error("Expected one admitted rerun.");
    await queue.cancelJob({ jobId: acceptedJob.id, userId: acceptedJob.userId });
    const nextRerun = await queue.rerunJob({
      jobId: original.id,
      userId: original.userId,
      idempotencyKey: "later-click",
    });
    expect(nextRerun.id).toBe(acceptedJob.id);

    const count = await client.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM jobs WHERE user_id = $1",
      [original.userId],
    );
    expect(count.rows[0]?.count).toBe(2);

    const firstPage = await queue.listPageForUser({ userId: original.userId, limit: 1 });
    expect(firstPage.jobs).toHaveLength(1);
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    expect(firstPage.jobs[0]).not.toHaveProperty("inputJson");
    if (firstPage.nextCursor === undefined) throw new Error("Expected a continuation cursor.");
    const secondPage = await queue.listPageForUser({
      userId: original.userId,
      limit: 1,
      cursor: firstPage.nextCursor,
    });
    expect(secondPage.jobs).toHaveLength(1);
    expect(secondPage.jobs[0]?.id).not.toBe(firstPage.jobs[0]?.id);
  }, 30_000);

  it("transactionally bounds terminal history while retaining active jobs", async () => {
    const queue = new PostgresJobQueue(client);
    const active = await queue.submit({
      userId: "user_owner11",
      leagueId: "league_100001",
      seasonId: "season_2026",
      kind: "export",
      inputJson: { type: "active-export" },
      idempotencyKey: "active-export",
    });
    for (let index = 0; index <= maximumRetainedTerminalJobsPerUser; index += 1) {
      const terminal = await queue.submit({
        userId: "user_owner11",
        leagueId: "league_100001",
        seasonId: "season_2026",
        kind: "export",
        inputJson: { type: "terminal-export", index },
        idempotencyKey: `terminal-export-${index}`,
      });
      await queue.cancelJob({ jobId: terminal.id, userId: terminal.userId });
    }

    const firstPage = await queue.listPageForUser({ userId: active.userId });
    expect(firstPage.jobs).toHaveLength(25);
    const retained = await client.query<{ status: string; count: number }>(
      "SELECT status, COUNT(*)::int AS count FROM jobs WHERE user_id = $1 GROUP BY status",
      [active.userId],
    );
    const counts = new Map(retained.rows.map(row => [row.status, row.count]));
    expect(counts.get("canceled")).toBe(maximumRetainedTerminalJobsPerUser);
    expect(counts.get("queued")).toBe(2);
  }, 30_000);
});
