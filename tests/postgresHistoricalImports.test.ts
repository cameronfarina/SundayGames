import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import {
  buildCurrentMockdLeagueSeason,
  type AuctionLeagueSeason,
} from "../src/platform/leagueSeason.js";
import {
  commitHistoricalImportBatch,
  previewHistoricalImportBatch,
  type HistoricalImportBatch,
  type HistoricalSaleRecord,
  type NormalizedHistoricalImportRow,
} from "../src/platform/historicalImports.js";
import { PostgresHistoricalImportRepository } from "../src/platform/postgresHistoricalImports.js";
import type { PostgresTransactionalQueryClient } from "../src/platform/postgresJobQueue.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";

const now = new Date("2026-08-09T12:00:00.000Z");

interface BatchRow {
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
  created_at: Date;
  committed_at: Date | null;
  superseded_at: Date | null;
  superseded_by_batch_id: string | null;
}

interface SaleRow {
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

const normalizeSql = (text: string): string => text.replace(/\s+/g, " ").trim();

const cloneJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

const jsonValue = (value: unknown): unknown => typeof value === "string"
  ? JSON.parse(value)
  : cloneJson(value);

const cloneBatchRow = (row: BatchRow): BatchRow => ({
  ...row,
  mapping_json: jsonValue(row.mapping_json),
  warnings_json: jsonValue(row.warnings_json),
  blockers_json: jsonValue(row.blockers_json),
  created_at: new Date(row.created_at.getTime()),
  committed_at: row.committed_at === null ? null : new Date(row.committed_at.getTime()),
  superseded_at: row.superseded_at === null ? null : new Date(row.superseded_at.getTime()),
});

class FakePostgresHistoricalImportClient implements PostgresTransactionalQueryClient {
  readonly batches = new Map<string, BatchRow>();
  readonly sales = new Map<string, SaleRow>();
  transactionCount = 0;

  #inTransaction = false;

  constructor(readonly season: AuctionLeagueSeason) {}

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    this.#inTransaction = true;
    try {
      return await operation(this);
    } finally {
      this.#inTransaction = false;
    }
  }

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    const normalizedSql = normalizeSql(text);

    if (normalizedSql.startsWith("SELECT s.id")) {
      const [leagueId, seasonYearOrId] = values as readonly [string, number | string];
      if (
        (normalizedSql.includes("WHERE s.league_id = $1") &&
          leagueId === this.season.leagueId &&
          seasonYearOrId === this.season.seasonYear) ||
        (normalizedSql.includes("WHERE s.id = $1") && leagueId === this.season.id)
      ) {
        return {
          rows: [{
            id: this.season.id,
            league_id: this.season.leagueId,
            season_year: this.season.seasonYear,
            name: this.season.league.name,
            status: this.season.setupStatus,
            settings_json: {
              expectedTeamCount: this.season.settings.expectedTeamCount,
              keeperPolicy: this.season.settings.keeperPolicy,
              draft: this.season.draft,
            },
            league_name: this.season.league.name,
            provider: this.season.league.provider,
            provider_league_id: this.season.league.externalLeagueId,
            budget: this.season.settings.auction.budgetDollars,
            minimum_bid: this.season.settings.auction.minimumBidDollars,
            slots_json: {
              rosterSize: this.season.settings.roster.rosterSize,
              lineup: this.season.settings.roster.lineup,
              lineupSlotCount: this.season.settings.roster.lineupSlotCount,
            },
            position_maximums_json: this.season.settings.roster.rosterMaximums,
          } as TRow],
        };
      }

      return { rows: [] };
    }

    if (normalizedSql.startsWith("SELECT pg_advisory_xact_lock")) {
      if (!this.#inTransaction) throw new Error("Preview pruning must hold a transaction lock.");
      return { rows: [] };
    }

    if (
      normalizedSql.startsWith("DELETE FROM historical_import_batches") &&
      normalizedSql.includes("created_at <= $2")
    ) {
      const [leagueId, expiresBefore] = values as readonly [string, Date];
      for (const [id, batch] of this.batches) {
        if (
          batch.league_id === leagueId &&
          (batch.status === "previewed" || batch.status === "blocked") &&
          batch.created_at <= expiresBefore
        ) this.batches.delete(id);
      }
      return { rows: [] };
    }

    if (normalizedSql.startsWith("DELETE FROM historical_import_batches")) {
      const [leagueId, maxRetained] = values as readonly [string, number];
      const discarded = [...this.batches.values()]
        .filter(batch =>
          batch.league_id === leagueId &&
          (batch.status === "previewed" || batch.status === "blocked")
        )
        .sort((left, right) =>
          right.created_at.getTime() - left.created_at.getTime() || right.id.localeCompare(left.id)
        )
        .slice(maxRetained);
      for (const batch of discarded) this.batches.delete(batch.id);
      return { rows: [] };
    }

    if (normalizedSql.startsWith("SELECT id, league_season_id, team_key")) {
      const [seasonId] = values as readonly [string];
      if (seasonId !== this.season.id) return { rows: [] };

      return {
        rows: this.season.teams.map(team => ({
          id: team.id,
          league_season_id: team.leagueSeasonId,
          team_key: team.ownerId,
          team_name: team.displayName,
          owner_name: team.ownerDisplayName,
          display_order: team.draftOrderPosition,
        } as TRow)),
      };
    }

    if (normalizedSql.startsWith("INSERT INTO historical_import_batches")) {
      const [
        id,
        leagueId,
        leagueSeasonId,
        seasonYear,
        uploadedByUserId,
        ,
        fileHash,
        status,
        replacementRequested,
        mappingJson,
        warningsJson,
        blockersJson,
        committedAt,
        supersededAt,
        supersededByBatchId,
        createdAt,
      ] = values as readonly [
        string,
        string,
        string | null,
        number,
        string,
        string,
        string,
        string,
        boolean,
        string,
        string,
        string,
        Date | null,
        Date | null,
        string | null,
        Date,
      ];
      const existing = this.batches.get(id);
      const row: BatchRow = {
        id,
        league_id: leagueId,
        league_season_id: leagueSeasonId,
        season_year: seasonYear,
        uploaded_by_user_id: uploadedByUserId,
        file_hash: fileHash,
        status,
        replacement_requested: replacementRequested,
        mapping_json: jsonValue(mappingJson),
        warnings_json: jsonValue(warningsJson),
        blockers_json: jsonValue(blockersJson),
        created_at: existing?.created_at ?? createdAt,
        committed_at: committedAt,
        superseded_at: supersededAt,
        superseded_by_batch_id: supersededByBatchId,
      };
      this.batches.set(id, row);

      return { rows: [cloneBatchRow(row) as TRow], rowCount: 1 };
    }

    if (normalizedSql.startsWith("SELECT id, league_id")) {
      const row = this.batchRowFor(normalizedSql, values);

      return { rows: row === undefined ? [] : [cloneBatchRow(row) as TRow] };
    }

    if (normalizedSql.startsWith("SELECT COUNT(*)")) {
      const [prefixPattern] = values as readonly [string];
      const prefix = prefixPattern.replace(/%$/u, "");
      const count = [...this.batches.keys()].filter(id => id.startsWith(prefix)).length;

      return { rows: [{ count } as TRow] };
    }

    if (normalizedSql.startsWith("INSERT INTO historical_draft_sales")) {
      const [
        id,
        leagueId,
        leagueSeasonId,
        seasonYear,
        batchId,
        ownerId,
        ownerDisplayName,
        playerId,
        playerName,
        position,
        priceDollars,
        publicPriceDollars,
        keeper,
        acquisitionType,
        rowNumber,
      ] = values as readonly [
        string,
        string,
        string,
        number,
        string,
        string,
        string,
        string,
        string,
        string,
        number,
        number | null,
        boolean,
        string,
        number,
      ];
      if (![...this.sales.values()].some(sale => sale.import_batch_id === batchId && sale.row_number === rowNumber)) {
        this.sales.set(id, {
          id,
          league_id: leagueId,
          league_season_id: leagueSeasonId,
          season_year: seasonYear,
          import_batch_id: batchId,
          owner_id: ownerId,
          owner_display_name: ownerDisplayName,
          player_id: playerId,
          player_name: playerName,
          position,
          price_dollars: priceDollars,
          public_price_dollars: publicPriceDollars,
          keeper,
          acquisition_type: acquisitionType,
          row_number: rowNumber,
        });
      }

      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.startsWith("SELECT historical_draft_sales.id")) {
      const [leagueId, seasonYear] = values as readonly [string, number];
      const throughSeason = normalizedSql.includes("historical_draft_sales.season_year <= $2");
      const rows = [...this.sales.values()]
        .filter(sale => {
          const batch = this.batches.get(sale.import_batch_id);

          return sale.league_id === leagueId &&
            (throughSeason ? sale.season_year <= seasonYear : sale.season_year === seasonYear) &&
            batch?.status === "committed";
        })
        .sort((a, b) => a.season_year - b.season_year || a.row_number - b.row_number || a.id.localeCompare(b.id))
        .map(sale => ({ ...sale } as TRow));

      return { rows };
    }

    throw new Error(`Unexpected SQL: ${text}`);
  }

  batchRowFor(normalizedSql: string, values: readonly unknown[]): BatchRow | undefined {
    if (normalizedSql.includes("WHERE id = $1")) {
      return this.batches.get(values[0] as string);
    }
    if (normalizedSql.includes("file_hash = $3") && normalizedSql.includes("status <> 'superseded'")) {
      const [leagueId, seasonYear, fileHash] = values as readonly [string, number, string];

      return [...this.batches.values()].find(batch =>
        batch.league_id === leagueId &&
        batch.season_year === seasonYear &&
        batch.file_hash === fileHash &&
        batch.status !== "superseded"
      );
    }
    if (normalizedSql.includes("file_hash = $3") && normalizedSql.includes("status = 'committed'")) {
      const [leagueId, seasonYear, fileHash] = values as readonly [string, number, string];

      return [...this.batches.values()].find(batch =>
        batch.league_id === leagueId &&
        batch.season_year === seasonYear &&
        batch.file_hash === fileHash &&
        batch.status === "committed"
      );
    }
    if (normalizedSql.includes("status = 'committed'")) {
      const [leagueId, seasonYear] = values as readonly [string, number];

      return [...this.batches.values()]
        .filter(batch =>
          batch.league_id === leagueId &&
          batch.season_year === seasonYear &&
          batch.status === "committed"
        )
        .sort((a, b) => (b.committed_at?.getTime() ?? 0) - (a.committed_at?.getTime() ?? 0))[0];
    }

    return undefined;
  }
}

const buildSeason = (): AuctionLeagueSeason =>
  buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    seasonYear: 2025,
    setupStatus: "locked",
  });

const row = (
  overrides: Partial<NormalizedHistoricalImportRow> = {},
): NormalizedHistoricalImportRow => {
  const playerId = overrides.playerId ?? "player-jamarr-chase";

  return {
    sourceRowNumber: 2,
    seasonYear: 2025,
    ownerDisplayName: "Owner11",
    playerName: "Ja'Marr Chase",
    playerId,
    position: "WR",
    priceDollars: 61,
    publicPriceDollars: 54,
    playerResolution: { status: "resolved", playerId },
    keeper: false,
    acquisitionType: "auction",
    ...overrides,
  };
};

describe("Postgres historical import repository", () => {
  it("persists preview batches and commits sale rows transactionally", async () => {
    const season = buildSeason();
    const client = new FakePostgresHistoricalImportClient(season);
    const repository = new PostgresHistoricalImportRepository(client);

    const preview = await previewHistoricalImportBatch({
      repository,
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
      fileHash: "sha256:first",
      uploadedByUserId: "acct_owner11",
      rows: [row()],
      now,
    });
    const committed = await commitHistoricalImportBatch({
      repository,
      batchId: preview.id,
      now: new Date("2026-08-09T12:01:00.000Z"),
    });

    expect(preview).toMatchObject({
      status: "previewed",
      uploadedByUserId: "acct_owner11",
      rows: [expect.objectContaining({ status: "ready" })],
    });
    expect(committed).toMatchObject({
      id: preview.id,
      status: "committed",
      committedAt: new Date("2026-08-09T12:01:00.000Z"),
    });
    expect(client.transactionCount).toBe(2);
    await expect(repository.currentRecords(season.leagueId, 2025)).resolves.toEqual([
      expect.objectContaining({
        batchId: preview.id,
        playerId: "player-jamarr-chase",
        priceDollars: 61,
        publicPriceDollars: 54,
      }),
    ] satisfies HistoricalSaleRecord[]);
  });

  it("keeps superseded sale rows for audit while current records read the replacement batch", async () => {
    const season = buildSeason();
    const client = new FakePostgresHistoricalImportClient(season);
    const repository = new PostgresHistoricalImportRepository(client);
    const firstPreview = await previewHistoricalImportBatch({
      repository,
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
      fileHash: "sha256:first",
      uploadedByUserId: "acct_owner11",
      rows: [row()],
      now,
    });
    const firstCommitted = await commitHistoricalImportBatch({
      repository,
      batchId: firstPreview.id,
      now: new Date("2026-08-09T12:01:00.000Z"),
    });
    const replacementPreview = await previewHistoricalImportBatch({
      repository,
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
      fileHash: "sha256:replacement",
      uploadedByUserId: "acct_owner11",
      replacementRequested: true,
      rows: [row({
        playerName: "Bijan Robinson",
        playerId: "player-bijan-robinson",
        playerResolution: { status: "resolved", playerId: "player-bijan-robinson" },
        position: "RB",
        priceDollars: 68,
      })],
      now: new Date("2026-08-09T12:02:00.000Z"),
    });

    const replacementCommitted = await commitHistoricalImportBatch({
      repository,
      batchId: replacementPreview.id,
      now: new Date("2026-08-09T12:03:00.000Z"),
    });

    expect(await repository.findBatchById(firstCommitted.id)).toMatchObject({
      status: "superseded",
      supersededByBatchId: replacementCommitted.id,
    });
    expect(client.sales.size).toBe(2);
    await expect(repository.currentRecords(season.leagueId, 2025)).resolves.toEqual([
      expect.objectContaining({
        batchId: replacementCommitted.id,
        playerId: "player-bijan-robinson",
        priceDollars: 68,
      }),
    ]);
  });

  it("bounds active previews under the same transaction that creates the next batch", async () => {
    const season = buildSeason();
    const client = new FakePostgresHistoricalImportClient(season);
    const repository = new PostgresHistoricalImportRepository(client);
    const preview = async (fileHash: string, createdAt: Date) => await previewHistoricalImportBatch({
      repository,
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
      fileHash,
      uploadedByUserId: "acct_owner11",
      rows: [row({ playerId: fileHash, playerResolution: { status: "resolved", playerId: fileHash } })],
      maxActivePreviewBatches: 2,
      previewTtlMs: 1_000,
      now: createdAt,
    });

    const expired = await preview("sha256:expired", now);
    const retained = await preview("sha256:retained", new Date(now.getTime() + 1_500));
    const newest = await preview("sha256:newest", new Date(now.getTime() + 2_000));
    const replacement = await preview("sha256:replacement", new Date(now.getTime() + 2_400));

    expect(client.batches.has(expired.id)).toBe(false);
    expect(client.batches.has(retained.id)).toBe(false);
    expect(client.batches.has(newest.id)).toBe(true);
    expect(client.batches.has(replacement.id)).toBe(true);
    expect([...client.batches.values()].filter(batch => batch.status === "previewed")).toHaveLength(2);
    expect(client.transactionCount).toBe(4);
  });
});
