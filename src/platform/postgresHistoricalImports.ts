import type { LeagueSeason } from "./leagueSeason.js";
import {
  type HistoricalImportBatch,
  type HistoricalImportIssue,
  type HistoricalImportRepository,
  type HistoricalImportRowPreview,
  type HistoricalSaleRecord,
  type PruneHistoricalImportPreviewsInput,
} from "./historicalImports.js";
import type { PostgresTransactionalQueryClient } from "./postgresJobQueue.js";
import {
  type PostgresQueryClient,
  type PostgresQueryResult,
} from "./postgresPlatformStore.js";
import { PostgresLeagueSetupRepository } from "./postgresLeagueSetup.js";

interface HistoricalImportBatchRow {
  id: string;
  league_id: string;
  league_season_id: string | null;
  season_year: number;
  uploaded_by_user_id: string;
  file_hash: string;
  status: string;
  replacement_requested: boolean;
  mapping_json: unknown;
  warnings_json: unknown;
  blockers_json: unknown;
  created_at: Date | string;
  committed_at: Date | string | null;
  superseded_at: Date | string | null;
  superseded_by_batch_id: string | null;
}

interface CountRow {
  count: string | number;
}

interface HistoricalSaleRow {
  id: string;
  league_id: string;
  league_season_id: string;
  season_year: number;
  import_batch_id: string;
  owner_id: string;
  owner_display_name: string;
  player_id: string;
  player_name: string;
  position: string;
  price_dollars: number;
  public_price_dollars: number | null;
  keeper: boolean;
  acquisition_type: string;
  row_number: number;
}

const firstRow = <TRow>(result: PostgresQueryResult<TRow>): TRow | undefined => result.rows[0];

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const jsonbParameter = (value: unknown): string => JSON.stringify(value);

const dateFromDb = (value: Date | string): Date =>
  value instanceof Date ? new Date(value.getTime()) : new Date(value);

const nullableDateFromDb = (value: Date | string | null): Date | undefined =>
  value === null ? undefined : dateFromDb(value);

const jsonObjectFromDb = (value: unknown): Record<string, unknown> => {
  if (value === undefined || value === null) return {};
  if (typeof value === "object" && !Array.isArray(value)) return cloneJson(value) as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;

      return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }

  return {};
};

const jsonArrayFromDb = <T>(value: unknown): readonly T[] => {
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;

  return Array.isArray(parsed) ? cloneJson(parsed) as readonly T[] : [];
};

const rowPreviewsFromDb = (value: unknown): readonly HistoricalImportRowPreview[] => {
  const mapping = jsonObjectFromDb(value);

  return jsonArrayFromDb<HistoricalImportRowPreview>(mapping.rows);
};

const batchMappingJsonFor = (batch: HistoricalImportBatch): Record<string, unknown> => ({
  rows: batch.rows,
});

const fileNameFor = (batch: HistoricalImportBatch): string =>
  `${batch.seasonYear}-${batch.fileHash.replace(/[^a-z0-9]+/giu, "-")}.csv`;

const requireUploadedByUserId = (batch: HistoricalImportBatch): string => {
  if (batch.uploadedByUserId !== undefined && batch.uploadedByUserId.trim().length > 0) {
    return batch.uploadedByUserId;
  }

  throw new Error("Postgres historical import batches require uploadedByUserId.");
};

const batchFromRow = (row: HistoricalImportBatchRow): HistoricalImportBatch => {
  const committedAt = nullableDateFromDb(row.committed_at);
  const supersededAt = nullableDateFromDb(row.superseded_at);

  return {
    id: row.id,
    leagueId: row.league_id,
    leagueSeasonId: row.league_season_id,
    seasonYear: Number(row.season_year),
    fileHash: row.file_hash,
    uploadedByUserId: row.uploaded_by_user_id,
    status: row.status as HistoricalImportBatch["status"],
    replacementRequested: row.replacement_requested,
    createdAt: dateFromDb(row.created_at),
    ...(committedAt === undefined ? {} : { committedAt }),
    ...(supersededAt === undefined ? {} : { supersededAt }),
    ...(row.superseded_by_batch_id === null ? {} : { supersededByBatchId: row.superseded_by_batch_id }),
    blockers: [...jsonArrayFromDb<HistoricalImportIssue>(row.blockers_json)],
    warnings: [...jsonArrayFromDb<HistoricalImportIssue>(row.warnings_json)],
    rows: [...rowPreviewsFromDb(row.mapping_json)],
  };
};

const saleRecordFromRow = (row: HistoricalSaleRow): HistoricalSaleRecord => ({
  id: row.id,
  batchId: row.import_batch_id,
  leagueId: row.league_id,
  leagueSeasonId: row.league_season_id,
  seasonYear: Number(row.season_year),
  rowNumber: Number(row.row_number),
  ownerId: row.owner_id,
  ownerDisplayName: row.owner_display_name,
  playerId: row.player_id,
  playerName: row.player_name,
  position: row.position as HistoricalSaleRecord["position"],
  priceDollars: Number(row.price_dollars),
  ...(row.public_price_dollars === null
    ? {}
    : { publicPriceDollars: Number(row.public_price_dollars) }),
  keeper: row.keeper,
  acquisitionType: row.acquisition_type as HistoricalSaleRecord["acquisitionType"],
});

const selectBatchSql = `
SELECT
  id,
  league_id,
  league_season_id,
  season_year,
  uploaded_by_user_id,
  file_hash,
  status,
  replacement_requested,
  mapping_json,
  warnings_json,
  blockers_json,
  created_at,
  committed_at,
  superseded_at,
  superseded_by_batch_id
FROM historical_import_batches
`.trim();

const selectSaleSql = `
SELECT
  historical_draft_sales.id,
  historical_draft_sales.league_id,
  historical_draft_sales.league_season_id,
  historical_draft_sales.season_year,
  historical_draft_sales.import_batch_id,
  historical_draft_sales.owner_id,
  historical_draft_sales.owner_display_name,
  historical_draft_sales.player_id,
  historical_draft_sales.player_name,
  historical_draft_sales.position,
  historical_draft_sales.price_dollars,
  historical_draft_sales.public_price_dollars,
  historical_draft_sales.keeper,
  historical_draft_sales.acquisition_type,
  historical_draft_sales.row_number
FROM historical_draft_sales
`.trim();

export class PostgresHistoricalImportRepository implements HistoricalImportRepository {
  readonly #transactionClient: PostgresTransactionalQueryClient;
  readonly #client: PostgresQueryClient;
  readonly #leagueSetupRepository: PostgresLeagueSetupRepository;

  constructor(
    transactionClient: PostgresTransactionalQueryClient,
    client: PostgresQueryClient = transactionClient,
  ) {
    this.#transactionClient = transactionClient;
    this.#client = client;
    this.#leagueSetupRepository = new PostgresLeagueSetupRepository(transactionClient);
  }

  async withTransaction<T>(
    operation: (repository: HistoricalImportRepository) => T | Promise<T>,
  ): Promise<T> {
    return await this.#transactionClient.transaction(async transactionClient =>
      await operation(new PostgresHistoricalImportRepository(this.#transactionClient, transactionClient))
    );
  }

  async findLeagueSeason(leagueId: string, seasonYear: number): Promise<LeagueSeason | null> {
    return await this.#leagueSetupRepository.findLeagueSeasonForLeagueYear(leagueId, seasonYear);
  }

  async findBatchById(batchId: string): Promise<HistoricalImportBatch | null> {
    const result = await this.#client.query<HistoricalImportBatchRow>(
      `${selectBatchSql} WHERE id = $1`,
      [batchId],
    );
    const row = firstRow(result);

    return row === undefined ? null : batchFromRow(row);
  }

  async findBatchByFileHash(
    leagueId: string,
    seasonYear: number,
    fileHash: string,
  ): Promise<HistoricalImportBatch | null> {
    const result = await this.#client.query<HistoricalImportBatchRow>(
      `${selectBatchSql} WHERE league_id = $1 AND season_year = $2 AND file_hash = $3 AND status <> 'superseded' ORDER BY created_at ASC, id ASC LIMIT 1`,
      [leagueId, seasonYear, fileHash],
    );
    const row = firstRow(result);

    return row === undefined ? null : batchFromRow(row);
  }

  async findCommittedBatchByFileHash(
    leagueId: string,
    seasonYear: number,
    fileHash: string,
  ): Promise<HistoricalImportBatch | null> {
    const result = await this.#client.query<HistoricalImportBatchRow>(
      `${selectBatchSql} WHERE league_id = $1 AND season_year = $2 AND file_hash = $3 AND status = 'committed' ORDER BY created_at ASC, id ASC LIMIT 1`,
      [leagueId, seasonYear, fileHash],
    );
    const row = firstRow(result);

    return row === undefined ? null : batchFromRow(row);
  }

  async findCurrentCommittedBatch(
    leagueId: string,
    seasonYear: number,
  ): Promise<HistoricalImportBatch | null> {
    const result = await this.#client.query<HistoricalImportBatchRow>(
      `${selectBatchSql} WHERE league_id = $1 AND season_year = $2 AND status = 'committed' ORDER BY committed_at DESC NULLS LAST, created_at DESC, id DESC LIMIT 1`,
      [leagueId, seasonYear],
    );
    const row = firstRow(result);

    return row === undefined ? null : batchFromRow(row);
  }

  async nextBatchOrdinal(
    leagueId: string,
    seasonYear: number,
    fileHash: string,
  ): Promise<number> {
    const prefix = `historical-import-${leagueId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${seasonYear}-${fileHash.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    const result = await this.#client.query<CountRow>(
      "SELECT COUNT(*)::integer AS count FROM historical_import_batches WHERE id LIKE $1",
      [`${prefix}-%`],
    );

    return Number(firstRow(result)?.count ?? 0) + 1;
  }

  async prunePreviewBatches({
    leagueId,
    expiresBefore,
    maxRetained,
  }: PruneHistoricalImportPreviewsInput): Promise<void> {
    await this.#client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [`historical-import-previews:${leagueId}`],
    );
    await this.#client.query(
      `DELETE FROM historical_import_batches
WHERE league_id = $1
  AND status IN ('previewed', 'blocked')
  AND created_at <= $2`,
      [leagueId, expiresBefore],
    );
    await this.#client.query(
      `DELETE FROM historical_import_batches
WHERE id IN (
  SELECT id
  FROM historical_import_batches
  WHERE league_id = $1
    AND status IN ('previewed', 'blocked')
  ORDER BY created_at DESC, id DESC
  OFFSET $2
)`,
      [leagueId, maxRetained],
    );
  }

  async createBatch(batch: HistoricalImportBatch): Promise<HistoricalImportBatch> {
    return await this.#upsertBatch(batch);
  }

  async updateBatch(batch: HistoricalImportBatch): Promise<HistoricalImportBatch> {
    return await this.#upsertBatch(batch);
  }

  async addRecords(records: readonly HistoricalSaleRecord[]): Promise<void> {
    for (const record of records) {
      await this.#client.query(
        `
INSERT INTO historical_draft_sales (
  id,
  league_id,
  league_season_id,
  season_year,
  import_batch_id,
  fantasy_team_id,
  owner_id,
  owner_display_name,
  player_id,
  player_name,
  position,
  price_dollars,
  public_price_dollars,
  keeper,
  acquisition_type,
  row_number
) VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
ON CONFLICT ON CONSTRAINT historical_draft_sales_batch_row_key DO NOTHING;
`.trim(),
        [
          record.id,
          record.leagueId,
          record.leagueSeasonId,
          record.seasonYear,
          record.batchId,
          record.ownerId,
          record.ownerDisplayName,
          record.playerId,
          record.playerName,
          record.position,
          record.priceDollars,
          record.publicPriceDollars ?? null,
          record.keeper,
          record.acquisitionType,
          record.rowNumber,
        ],
      );
    }
  }

  async currentRecords(leagueId: string, seasonYear: number): Promise<HistoricalSaleRecord[]> {
    const result = await this.#client.query<HistoricalSaleRow>(
      `
${selectSaleSql}
JOIN historical_import_batches b ON b.id = historical_draft_sales.import_batch_id
WHERE historical_draft_sales.league_id = $1
  AND historical_draft_sales.season_year = $2
  AND b.status = 'committed'
ORDER BY historical_draft_sales.season_year ASC, historical_draft_sales.row_number ASC, historical_draft_sales.id ASC
`.trim(),
      [leagueId, seasonYear],
    );

    return result.rows.map(saleRecordFromRow);
  }

  async currentRecordsThroughSeason(leagueId: string, seasonYear: number): Promise<HistoricalSaleRecord[]> {
    const result = await this.#client.query<HistoricalSaleRow>(
      `
${selectSaleSql}
JOIN historical_import_batches b ON b.id = historical_draft_sales.import_batch_id
WHERE historical_draft_sales.league_id = $1
  AND historical_draft_sales.season_year <= $2
  AND b.status = 'committed'
ORDER BY historical_draft_sales.season_year ASC, historical_draft_sales.row_number ASC, historical_draft_sales.id ASC
`.trim(),
      [leagueId, seasonYear],
    );

    return result.rows.map(saleRecordFromRow);
  }

  async #upsertBatch(batch: HistoricalImportBatch): Promise<HistoricalImportBatch> {
    const uploadedByUserId = requireUploadedByUserId(batch);
    const result = await this.#client.query<HistoricalImportBatchRow>(
      `
INSERT INTO historical_import_batches (
  id,
  league_id,
  league_season_id,
  season_year,
  uploaded_by_user_id,
  file_name,
  file_hash,
  status,
  replacement_requested,
  mapping_json,
  warnings_json,
  blockers_json,
  committed_at,
  superseded_at,
  superseded_by_batch_id,
  created_at,
  updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13, $14, $15, $16, $16)
ON CONFLICT (id) DO UPDATE SET
  league_id = EXCLUDED.league_id,
  league_season_id = EXCLUDED.league_season_id,
  season_year = EXCLUDED.season_year,
  uploaded_by_user_id = EXCLUDED.uploaded_by_user_id,
  file_name = EXCLUDED.file_name,
  file_hash = EXCLUDED.file_hash,
  status = EXCLUDED.status,
  replacement_requested = EXCLUDED.replacement_requested,
  mapping_json = EXCLUDED.mapping_json,
  warnings_json = EXCLUDED.warnings_json,
  blockers_json = EXCLUDED.blockers_json,
  committed_at = EXCLUDED.committed_at,
  superseded_at = EXCLUDED.superseded_at,
  superseded_by_batch_id = EXCLUDED.superseded_by_batch_id,
  updated_at = EXCLUDED.updated_at
RETURNING
  id,
  league_id,
  league_season_id,
  season_year,
  uploaded_by_user_id,
  file_hash,
  status,
  replacement_requested,
  mapping_json,
  warnings_json,
  blockers_json,
  created_at,
  committed_at,
  superseded_at,
  superseded_by_batch_id;
`.trim(),
      [
        batch.id,
        batch.leagueId,
        batch.leagueSeasonId,
        batch.seasonYear,
        uploadedByUserId,
        fileNameFor(batch),
        batch.fileHash,
        batch.status,
        batch.replacementRequested,
        jsonbParameter(batchMappingJsonFor(batch)),
        jsonbParameter(batch.warnings),
        jsonbParameter(batch.blockers),
        batch.committedAt ?? null,
        batch.supersededAt ?? null,
        batch.supersededByBatchId ?? null,
        batch.createdAt,
      ],
    );
    const row = firstRow(result);
    if (row === undefined) {
      throw new Error("Postgres historical import batch upsert did not return a row.");
    }

    return batchFromRow(row);
  }
}
