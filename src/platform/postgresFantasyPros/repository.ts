import type {
  ClaimFantasyProsRefreshInput,
  FantasyProsDatasetStatus,
  FantasyProsProjectionsQuery,
  FantasyProsRankingsQuery,
  FantasyProsRepository,
  FantasyProsStoredPlayer,
  FantasyProsStoredProjection,
  FantasyProsStoredRanking,
  RecordFantasyProsRefreshOutcomeInput,
  SaveFantasyProsPlayersInput,
  SaveFantasyProsProjectionsInput,
  SaveFantasyProsRankingsInput,
} from "../fantasyPros.js";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import type {
  FantasyProsFetchLogRow,
  FantasyProsPlayerRow,
  FantasyProsProjectionRow,
  FantasyProsRankingRow,
} from "./contracts.js";
import {
  datasetStatusFromRow,
  playerFromRow,
  projectionFromRow,
  rankingFromRow,
} from "./mapping.js";
import { playerRowValues, projectionRowValues, rankingRowValues } from "./rows.js";
import {
  claimRefreshSql,
  fantasyProsUpsertBatchSize,
  recordRefreshOutcomeSql,
  selectFetchLogSql,
  selectPlayersSql,
  selectProjectionsSql,
  selectRankingsSql,
  upsertPlayersSql,
  upsertProjectionsSql,
  upsertRankingsSql,
} from "./sql.js";

const batches = <TValue>(values: readonly TValue[]): readonly (readonly TValue[])[] => {
  const chunks: TValue[][] = [];
  for (let index = 0; index < values.length; index += fantasyProsUpsertBatchSize) {
    chunks.push(values.slice(index, index + fantasyProsUpsertBatchSize));
  }
  return chunks;
};

export class PostgresFantasyProsRepository implements FantasyProsRepository {
  readonly #client: PostgresTransactionalQueryClient;

  constructor(client: PostgresTransactionalQueryClient) {
    this.#client = client;
  }

  async #upsert(
    sqlFor: (rowCount: number) => string,
    rows: readonly (readonly unknown[])[],
  ): Promise<void> {
    for (const batch of batches(rows)) {
      await this.#client.query(sqlFor(batch.length), batch.flat());
    }
  }

  async saveRankings(input: SaveFantasyProsRankingsInput): Promise<void> {
    await this.#upsert(upsertRankingsSql, rankingRowValues(input));
  }

  async rankings(query: FantasyProsRankingsQuery): Promise<readonly FantasyProsStoredRanking[]> {
    const result = await this.#client.query<FantasyProsRankingRow>(
      selectRankingsSql,
      [query.rankingType, query.week ?? null],
    );
    return result.rows.map(rankingFromRow);
  }

  async saveProjections(input: SaveFantasyProsProjectionsInput): Promise<void> {
    await this.#upsert(upsertProjectionsSql, projectionRowValues(input));
  }

  async projections(
    query: FantasyProsProjectionsQuery,
  ): Promise<readonly FantasyProsStoredProjection[]> {
    const result = await this.#client.query<FantasyProsProjectionRow>(
      selectProjectionsSql,
      [query.week, query.position ?? null],
    );
    return result.rows.map(projectionFromRow);
  }

  async savePlayers(input: SaveFantasyProsPlayersInput): Promise<void> {
    await this.#upsert(upsertPlayersSql, playerRowValues(input));
  }

  async players(): Promise<readonly FantasyProsStoredPlayer[]> {
    const result = await this.#client.query<FantasyProsPlayerRow>(selectPlayersSql, []);
    return result.rows.map(playerFromRow);
  }

  async claimRefresh(input: ClaimFantasyProsRefreshInput): Promise<boolean> {
    const nowIso = input.now.toISOString();
    const cutoff = new Date(input.now.getTime() - input.cadenceMs).toISOString();
    const result = await this.#client.query(claimRefreshSql, [input.dataset, nowIso, cutoff]);
    return (result.rowCount ?? result.rows.length) > 0;
  }

  async recordRefreshOutcome(input: RecordFantasyProsRefreshOutcomeInput): Promise<void> {
    await this.#client.query(recordRefreshOutcomeSql, [
      input.dataset,
      input.requestCount,
      input.rowCount ?? null,
      input.error ?? null,
      input.now.toISOString(),
    ]);
  }

  async datasetStatuses(): Promise<readonly FantasyProsDatasetStatus[]> {
    const result = await this.#client.query<FantasyProsFetchLogRow>(selectFetchLogSql, []);
    return result.rows.flatMap(row => {
      const status = datasetStatusFromRow(row);
      return status === undefined ? [] : [status];
    });
  }
}
