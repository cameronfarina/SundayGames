import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createNodePostgresClient,
  type NodePostgresClient,
} from "../src/platform/postgresClient.js";
import { applyPlatformPostgresMigrations } from "../src/platform/platformMigrations.js";
import { PostgresSimulationRepository } from "../src/platform/postgresSimulations.js";
import { maximumRetainedSimulationRunsPerUser } from "../src/platform/simulationLimits.js";
import type { SimulationResult, SimulationRun } from "../src/platform/simulations.js";

const databaseUrl = process.env.MOCKD_POSTGRES_INTEGRATION_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl === undefined || databaseUrl.length === 0
  ? describe.skip
  : describe;

const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;

const completionFor = (run: SimulationRun, completedAt = new Date()): SimulationResult => ({
  runId: run.id,
  requestId: run.request.id,
  completedAt,
  runCount: run.request.count,
  seedPrefix: run.request.seedPrefix,
  hardLockCount: 0,
  softTargetCount: 0,
  forcedSales: [],
  summary: { runCount: run.request.count, scenarios: [], players: [], owners: [], ownerPlayerExposure: [] },
});

const requestFor = (idempotencyKey: string, seedPrefix = idempotencyKey, createdAt?: Date) => ({
  userId: "user_cam",
  leagueId: "league_100001",
  seasonId: "season_2026",
  ownerId: "owner_cam",
  teamId: "team_cam",
  count: 25,
  seedPrefix,
  idempotencyKey,
  strategy: {},
  ...(createdAt === undefined ? {} : { createdAt }),
});

describeWithPostgres("Postgres browser simulation lifecycle", () => {
  let adminClient: NodePostgresClient;
  let client: NodePostgresClient;
  let schemaName: string;

  beforeAll(async () => {
    if (databaseUrl === undefined || databaseUrl.length === 0) {
      throw new Error("MOCKD_POSTGRES_INTEGRATION_DATABASE_URL is required.");
    }
    schemaName = `mockd_simulation_admission_${randomUUID().replaceAll("-", "")}`;
    adminClient = createNodePostgresClient({ databaseUrl, max: 1 });
    await adminClient.query(`CREATE SCHEMA ${quoteIdentifier(schemaName)}`);
    const isolatedUrl = new URL(databaseUrl);
    isolatedUrl.searchParams.set("options", `-c search_path=${schemaName}`);
    client = createNodePostgresClient({ databaseUrl: isolatedUrl.toString(), max: 30 });
    await applyPlatformPostgresMigrations(client);
    await client.query(
      `INSERT INTO accounts (id, email, email_normalized, password_hash)
       VALUES ('user_cam', 'owner11@example.com', 'owner11@example.com', 'hash')`,
    );
    await client.query(
      `INSERT INTO leagues (id, name, slug, created_by_user_id)
       VALUES ('league_100001', 'Sunday Games', 'sunday-games', 'user_cam')`,
    );
    await client.query(
      `INSERT INTO league_seasons (id, league_id, season_year, name)
       VALUES ('season_2026', 'league_100001', 2026, '2026')`,
    );
    await client.query(
      `INSERT INTO fantasy_teams (
         id, league_season_id, team_key, team_name, owner_name, display_order
       ) VALUES ('team_cam', 'season_2026', 'owner11', 'Short King', 'Owner11', 1)`,
    );
  }, 30_000);

  afterAll(async () => {
    await client?.close();
    if (adminClient !== undefined && schemaName !== undefined) {
      await adminClient.query(`DROP SCHEMA ${quoteIdentifier(schemaName)} CASCADE`);
    }
    await adminClient?.close();
  });

  it("admits concurrent launches, keeps the first terminal transition, and retains 25 completions", async () => {
    const repository = new PostgresSimulationRepository(client);
    const attempts = Array.from(
      { length: maximumRetainedSimulationRunsPerUser + 1 },
      (_, index) => repository.createRequest(requestFor(`concurrent-${index}`)),
    );

    const outcomes = await Promise.allSettled(attempts);
    expect(outcomes.every(outcome => outcome.status === "fulfilled")).toBe(true);
    const runs = outcomes.flatMap(outcome => outcome.status === "fulfilled" ? [outcome.value] : []);
    await Promise.all(runs.map(async run => await repository.markCanceled(run.id)));

    const racingRun = await repository.createRequest(requestFor("terminal-race"));
    await Promise.all([
      repository.complete(racingRun.id, completionFor(racingRun)),
      repository.markCanceled(racingRun.id),
    ]);
    const terminal = await repository.find(racingRun.id);
    expect(["completed", "canceled"]).toContain(terminal.status);
    expect(terminal.status === "completed" ? terminal.result !== undefined : terminal.result === undefined)
      .toBe(true);

    for (let index = 0; index < maximumRetainedSimulationRunsPerUser + 1; index += 1) {
      const completedAt = new Date(Date.UTC(2026, 7, 21, 12, 0, index));
      const run = await repository.createRequest(requestFor(
        `retained-${index}`,
        `retained-${index}`,
        completedAt,
      ));
      await repository.complete(run.id, completionFor(run, completedAt));
    }

    const completedCount = await client.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM simulation_runs WHERE user_id = $1 AND status = 'completed'",
      ["user_cam"],
    );
    expect(completedCount.rows[0]?.count).toBe(maximumRetainedSimulationRunsPerUser);

    const abandoned = await repository.createRequest(requestFor(
      "abandoned",
      "abandoned",
      new Date("2026-08-21T08:00:00.000Z"),
    ));
    await expect(repository.findByRequestKeyForUser(
      "user_cam",
      "season_2026",
      "abandoned",
    )).resolves.toMatchObject({ id: abandoned.id });
    await repository.reconcileAbandoned(new Date("2026-08-21T10:00:00.000Z"));
    await expect(repository.find(abandoned.id)).rejects.toMatchObject({ code: "simulation_not_found" });
  }, 30_000);
});
