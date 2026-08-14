import { describe, expect, it } from "vitest";
import type {
  HistoricalImportBatch,
  HistoricalImportRepository,
} from "../src/platform/historicalImports.js";
import type { PostgresTransactionalQueryClient } from "../src/platform/postgresJobQueue.js";
import { PostgresHistoricalImportRepository } from "../src/platform/postgresHistoricalImports.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";

interface QueryCall {
  text: string;
  values: readonly unknown[];
}

class FailingQueryClient implements PostgresQueryClient {
  readonly calls: QueryCall[] = [];

  async query<TRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    this.calls.push({ text, values });
    throw new Error("scoped query failed");
  }
}

class TransactionBoundary implements PostgresTransactionalQueryClient {
  readonly scopedClient = new FailingQueryClient();
  transactionCount = 0;
  rollbackCount = 0;

  async query<TRow>(): Promise<PostgresQueryResult<TRow>> {
    throw new Error("root client must not be used inside a transaction");
  }

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    try {
      return await operation(this.scopedClient);
    } catch (error) {
      this.rollbackCount += 1;
      throw error;
    }
  }
}

class EmptyQueryClient implements PostgresQueryClient {
  queryCount = 0;

  async query<TRow>(): Promise<PostgresQueryResult<TRow>> {
    this.queryCount += 1;
    return { rows: [] };
  }
}

const batch = (uploadedByUserId?: string): HistoricalImportBatch => ({
  id: "batch-1",
  leagueId: "league-private",
  leagueSeasonId: "season-2025",
  seasonYear: 2025,
  fileHash: "sha256:private",
  ...(uploadedByUserId === undefined ? {} : { uploadedByUserId }),
  status: "previewed",
  replacementRequested: false,
  createdAt: new Date("2026-08-09T12:00:00.000Z"),
  blockers: [],
  warnings: [],
  rows: [],
});

const runScopedRead = async (repository: HistoricalImportRepository): Promise<void> => {
  await repository.currentRecords("league-private", 2025);
};

describe("Postgres historical import isolation", () => {
  it("uses the transaction-scoped client and propagates rollback errors", async () => {
    const client = new TransactionBoundary();
    const repository = new PostgresHistoricalImportRepository(client);

    await expect(repository.withTransaction(runScopedRead)).rejects.toThrow("scoped query failed");
    expect(client.transactionCount).toBe(1);
    expect(client.rollbackCount).toBe(1);
    expect(client.scopedClient.calls).toHaveLength(1);
  });

  it("binds league identity to exact and through-season sale reads", async () => {
    const client = new FailingQueryClient();
    const repository = new PostgresHistoricalImportRepository(new TransactionBoundary(), client);

    await expect(repository.currentRecords("league-private", 2025)).rejects.toThrow();
    await expect(repository.currentRecordsThroughSeason("league-private", 2025)).rejects.toThrow();

    expect(client.calls).toHaveLength(2);
    for (const call of client.calls) {
      expect(call.text).toContain("historical_draft_sales.league_id = $1");
      expect(call.values).toEqual(["league-private", 2025]);
    }
  });

  it("rejects unattributed batches before writing private import data", async () => {
    const client = new EmptyQueryClient();
    const repository = new PostgresHistoricalImportRepository(new TransactionBoundary(), client);

    await expect(repository.createBatch(batch())).rejects.toThrow("require uploadedByUserId");
    expect(client.queryCount).toBe(0);
  });

  it("fails when an upsert does not return the persisted batch", async () => {
    const client = new EmptyQueryClient();
    const repository = new PostgresHistoricalImportRepository(new TransactionBoundary(), client);

    await expect(repository.createBatch(batch("user-1"))).rejects.toThrow("did not return a row");
    expect(client.queryCount).toBe(1);
  });
});
