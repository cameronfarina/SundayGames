import { describe, expect, it } from "vitest";
import type { PostgresTransactionalQueryClient } from "../src/platform/postgresJobQueue.js";
import type { PostgresQueryClient, PostgresQueryResult } from "../src/platform/postgresPlatformStore.js";
import { PostgresFantasyProsRepository } from "../src/platform/postgresFantasyPros.js";
import { fantasyProsUpsertBatchSize } from "../src/platform/postgresFantasyPros/sql.js";
import {
  datasetStatusFromRow,
  projectionFromRow,
  rankingFromRow,
} from "../src/platform/postgresFantasyPros/mapping.js";

interface RecordedQuery {
  sql: string;
  values: readonly unknown[];
}

class RecordingClient implements PostgresTransactionalQueryClient {
  readonly queries: RecordedQuery[] = [];
  rowsToReturn: readonly unknown[] = [];

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    return await operation(this);
  }

  query<TRow = Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<PostgresQueryResult<TRow>>;
  async query(sql: string, values: readonly unknown[] = []): Promise<PostgresQueryResult<unknown>> {
    this.queries.push({ sql, values });
    return { rows: [...this.rowsToReturn], rowCount: this.rowsToReturn.length };
  }
}

const player = (playerId: number) => ({
  playerId,
  playerName: `Player ${playerId}`,
  position: "WR",
  positions: ["WR"],
});

describe("Postgres FantasyPros repository", () => {
  it("writes a catalog refresh in bounded batches instead of one statement per row", async () => {
    const client = new RecordingClient();
    const repository = new PostgresFantasyProsRepository(client);
    const players = Array.from({ length: 8_525 }, (_unused, index) => player(index + 1));

    await repository.savePlayers({ players, fetchedAt: "2026-09-10T12:00:00.000Z" });

    expect(client.queries.length)
      .toBe(Math.ceil(players.length / fantasyProsUpsertBatchSize));
    const columnCount = 10;
    for (const query of client.queries) {
      expect(query.values.length % columnCount).toBe(0);
      expect(query.values.length / columnCount).toBeLessThanOrEqual(fantasyProsUpsertBatchSize);
      // Postgres caps a statement at 65535 bind parameters.
      expect(query.values.length).toBeLessThan(65_535);
    }
    expect(client.queries[0]?.sql).toContain("ON CONFLICT (player_id) DO UPDATE SET");
    expect(client.queries[0]?.sql).toContain("$7::jsonb");
  });

  it("issues no statement when a dataset comes back empty", async () => {
    const client = new RecordingClient();
    const repository = new PostgresFantasyProsRepository(client);

    await repository.saveRankings({
      rankingType: "waiver",
      scoring: "PPR",
      week: 1,
      rankings: [],
      fetchedAt: "2026-09-10T12:00:00.000Z",
    });

    expect(client.queries).toEqual([]);
  });

  it("numbers every placeholder across a multi-row insert", async () => {
    const client = new RecordingClient();
    const repository = new PostgresFantasyProsRepository(client);

    await repository.savePlayers({
      players: [player(1), player(2), player(3)],
      fetchedAt: "2026-09-10T12:00:00.000Z",
    });

    const sql = client.queries[0]?.sql ?? "";
    const placeholders = [...sql.matchAll(/\$(\d+)/gu)].map(match => Number(match[1]));
    expect(new Set(placeholders).size).toBe(30);
    expect(Math.max(...placeholders)).toBe(30);
  });

  it("never names the same conflict key twice inside one batch", async () => {
    // Postgres rejects a batch that touches a row twice with
    // "ON CONFLICT DO UPDATE command cannot affect row a second time", while
    // the in-memory Map silently overwrites and hides the difference.
    const client = new RecordingClient();
    const repository = new PostgresFantasyProsRepository(client);

    await repository.saveProjections({
      week: 0,
      position: "RB",
      fetchedAt: "2026-09-10T12:00:00.000Z",
      projections: [
        { playerId: 1, playerName: "First Listing", position: "RB", pointsPpr: 10 },
        { playerId: 2, playerName: "Other Player", position: "RB", pointsPpr: 9 },
        { playerId: 1, playerName: "Duplicate Listing", position: "RB", pointsPpr: 11 },
      ],
    });

    const columnCount = 16;
    const values = client.queries[0]?.values ?? [];
    expect(values.length / columnCount).toBe(2);
    // The later listing wins, matching what the in-memory store does.
    expect(values).toContain("Duplicate Listing");
    expect(values).not.toContain("First Listing");
  });

  it("collapses a repeated player in a catalog batch", async () => {
    const client = new RecordingClient();
    const repository = new PostgresFantasyProsRepository(client);

    await repository.savePlayers({
      players: [player(1), player(2), player(1)],
      fetchedAt: "2026-09-10T12:00:00.000Z",
    });

    expect((client.queries[0]?.values ?? []).length / 10).toBe(2);
  });

  it("rewinds the stored timestamp so a failed dataset retries sooner", async () => {
    const client = new RecordingClient();
    const repository = new PostgresFantasyProsRepository(client);
    const now = new Date("2026-09-10T12:00:00.000Z");

    await repository.recordRefreshOutcome({
      dataset: "projections-ros",
      now,
      requestCount: 6,
      rowCount: 0,
      error: "QB: failed with 429",
      retryDelayMs: 30 * 60 * 1000,
      cadenceMs: 6 * 60 * 60 * 1000,
    });

    const update = client.queries[0];
    expect(update?.sql).toContain("last_fetched_at = COALESCE($6::timestamptz, last_fetched_at)");
    // now - 6h + 30m, so the next claim succeeds 30 minutes from now.
    expect(update?.values[5]).toBe("2026-09-10T06:30:00.000Z");
  });

  it("leaves the stored timestamp alone after a success", async () => {
    const client = new RecordingClient();
    const repository = new PostgresFantasyProsRepository(client);

    await repository.recordRefreshOutcome({
      dataset: "players",
      now: new Date("2026-09-10T12:00:00.000Z"),
      requestCount: 1,
      rowCount: 8525,
    });

    expect(client.queries[0]?.values[5]).toBeNull();
  });

  it("lets Postgres compare the cadence cutoff against the stored timestamp", async () => {
    const client = new RecordingClient();
    const repository = new PostgresFantasyProsRepository(client);
    const now = new Date("2026-09-10T12:00:00.000Z");

    client.rowsToReturn = [{ dataset: "players" }];
    await expect(repository.claimRefresh({ dataset: "players", now, cadenceMs: 3_600_000 }))
      .resolves.toBe(true);

    const claim = client.queries[0];
    expect(claim?.sql).toContain("WHERE fantasy_pros_fetch_log.last_fetched_at < $3");
    expect(claim?.values).toEqual([
      "players",
      "2026-09-10T12:00:00.000Z",
      "2026-09-10T11:00:00.000Z",
    ]);

    client.rowsToReturn = [];
    await expect(repository.claimRefresh({ dataset: "players", now, cadenceMs: 3_600_000 }))
      .resolves.toBe(false);
  });
});

describe("Postgres FantasyPros row mapping", () => {
  it("parses numeric columns that Postgres returns as strings", () => {
    const ranking = rankingFromRow({
      ranking_type: "ros",
      scoring: "PPR",
      week: 0,
      player_id: 22968,
      player_name: "Jahmyr Gibbs",
      player_position: "RB",
      player_team: "DET",
      yahoo_id: "40059",
      rank_ecr: 2,
      rank_min: 1,
      rank_max: 4,
      rank_average: "1.20",
      rank_standard_deviation: "0.40",
      tier: 1,
      position_rank: "RB1",
      bye_week: 6,
      ecr_delta: null,
      owned_average: "99.5",
      owned_espn: 99.9,
      owned_yahoo: "100",
      fetched_at: new Date("2026-09-10T12:00:00.000Z"),
    });

    expect(ranking).toMatchObject({
      rankAverage: 1.2,
      rankStandardDeviation: 0.4,
      ownedAverage: 99.5,
      ownedEspn: 99.9,
      ownedYahoo: 100,
      ecrDelta: undefined,
      fetchedAt: "2026-09-10T12:00:00.000Z",
    });
  });

  it("keeps missing projection stat lines undefined rather than zero", () => {
    const projection = projectionFromRow({
      week: 1,
      player_id: 19275,
      player_name: "Jalen Hurts",
      player_position: "QB",
      player_team: "PHI",
      points: "20.28",
      points_ppr: "20.28",
      passing_yards: "221.87",
      passing_touchdowns: "1.55",
      interceptions: "0.54",
      rushing_yards: "27.81",
      rushing_touchdowns: "0.56",
      receptions: null,
      receiving_yards: null,
      receiving_touchdowns: null,
      fetched_at: "2026-09-10T12:00:00.000Z",
    });

    expect(projection.pointsPpr).toBe(20.28);
    expect(projection.receptions).toBeUndefined();
  });

  it("drops a fetch-log row naming a dataset this build does not know", () => {
    const row = {
      dataset: "rankings-dynasty",
      last_fetched_at: "2026-09-10T12:00:00.000Z",
      last_succeeded_at: null,
      request_count: "3",
      row_count: "0",
      last_error: null,
    };

    expect(datasetStatusFromRow(row)).toBeUndefined();
    expect(datasetStatusFromRow({ ...row, dataset: "players" }))
      .toMatchObject({ dataset: "players", requestCount: 3, lastSucceededAt: undefined });
  });
});
