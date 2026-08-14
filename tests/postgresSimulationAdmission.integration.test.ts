import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createNodePostgresClient,
  type NodePostgresClient,
} from "../src/platform/postgresClient.js";
import { applyPlatformPostgresMigrations } from "../src/platform/platformMigrations.js";
import { PostgresSimulationRepository } from "../src/platform/postgresSimulations.js";
import { maximumRetainedSimulationRunsPerUser } from "../src/platform/simulationLimits.js";
import { SimulationError } from "../src/platform/simulations.js";

const databaseUrl = process.env.MOCKD_POSTGRES_INTEGRATION_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl === undefined || databaseUrl.length === 0
  ? describe.skip
  : describe;

const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;

describeWithPostgres("Postgres simulation admission", () => {
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
      `INSERT INTO leagues (id, name, created_by_user_id)
       VALUES ('league_100001', 'Sunday Games', 'user_cam')`,
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

  it("persists at most the quota under limit-plus-one concurrent creates", async () => {
    const repository = new PostgresSimulationRepository(client);
    const attempts = Array.from(
      { length: maximumRetainedSimulationRunsPerUser + 1 },
      (_, index) => repository.createRequest({
        userId: "user_cam",
        leagueId: "league_100001",
        seasonId: "season_2026",
        ownerId: "owner_cam",
        teamId: "team_cam",
        count: 25,
        seedPrefix: `concurrent-${index}`,
        idempotencyKey: `concurrent-${index}`,
        strategy: {},
      }),
    );

    const outcomes = await Promise.allSettled(attempts);
    expect(outcomes.filter(outcome => outcome.status === "fulfilled"))
      .toHaveLength(maximumRetainedSimulationRunsPerUser);
    expect(outcomes.filter(outcome => outcome.status === "rejected"))
      .toEqual([expect.objectContaining({
        reason: new SimulationError(
          "simulation_capacity_reached",
          "Finish or cancel an active simulation before starting another one.",
        ),
      })]);
    const count = await client.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM simulation_runs WHERE user_id = $1",
      ["user_cam"],
    );
    expect(count.rows[0]?.count).toBe(maximumRetainedSimulationRunsPerUser);
  }, 30_000);
});
