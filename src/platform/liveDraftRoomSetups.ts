import { createHash } from "node:crypto";
import type {
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomPlayerCatalogEntry,
} from "./liveDraftRooms.js";
import type { PostgresQueryClient } from "./postgresPlatformStore.js";

export interface LiveDraftRoomSetup {
  seasonId: string;
  sourceVersion: string;
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[];
  initialRosters: readonly LiveDraftRoomInitialRosterPlayer[];
  contentHash: string;
  updatedAt: Date;
}

export interface SaveLiveDraftRoomSetupInput {
  seasonId: string;
  sourceVersion: string;
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[];
  initialRosters: readonly LiveDraftRoomInitialRosterPlayer[];
  updatedAt?: Date | undefined;
}

export interface LiveDraftRoomSetupRepository {
  findForSeason(seasonId: string): Promise<LiveDraftRoomSetup | null>;
  save(input: SaveLiveDraftRoomSetupInput): Promise<LiveDraftRoomSetup>;
}

export interface LiveDraftRoomSetupPostgresRow {
  league_season_id: string;
  source_version: string;
  player_catalog_json: unknown;
  initial_rosters_json: unknown;
  content_hash: string;
  updated_at: Date | string;
}

const canonicalSetupPayload = (input: SaveLiveDraftRoomSetupInput): string => JSON.stringify({
  seasonId: input.seasonId,
  sourceVersion: input.sourceVersion,
  playerCatalog: input.playerCatalog,
  initialRosters: input.initialRosters,
});

export const liveDraftRoomSetupContentHash = (input: SaveLiveDraftRoomSetupInput): string =>
  createHash("sha256").update(canonicalSetupPayload(input)).digest("hex");

const setupFor = (input: SaveLiveDraftRoomSetupInput): LiveDraftRoomSetup => ({
  seasonId: input.seasonId,
  sourceVersion: input.sourceVersion,
  playerCatalog: structuredClone(input.playerCatalog),
  initialRosters: structuredClone(input.initialRosters),
  contentHash: liveDraftRoomSetupContentHash(input),
  updatedAt: input.updatedAt ?? new Date(),
});

const arrayValue = <T>(value: unknown, label: string): readonly T[] => {
  if (!Array.isArray(value)) throw new Error(`Stored live draft ${label} must be an array.`);
  return value as readonly T[];
};

const setupFromRow = (row: LiveDraftRoomSetupPostgresRow): LiveDraftRoomSetup => ({
  seasonId: row.league_season_id,
  sourceVersion: row.source_version,
  playerCatalog: structuredClone(arrayValue<LiveDraftRoomPlayerCatalogEntry>(
    row.player_catalog_json,
    "player catalog",
  )),
  initialRosters: structuredClone(arrayValue<LiveDraftRoomInitialRosterPlayer>(
    row.initial_rosters_json,
    "initial rosters",
  )),
  contentHash: row.content_hash,
  updatedAt: row.updated_at instanceof Date ? new Date(row.updated_at) : new Date(row.updated_at),
});

export class InMemoryLiveDraftRoomSetupRepository implements LiveDraftRoomSetupRepository {
  readonly #setups = new Map<string, LiveDraftRoomSetup>();

  async findForSeason(seasonId: string): Promise<LiveDraftRoomSetup | null> {
    const setup = this.#setups.get(seasonId);
    return setup === undefined ? null : structuredClone(setup);
  }

  async save(input: SaveLiveDraftRoomSetupInput): Promise<LiveDraftRoomSetup> {
    const setup = setupFor(input);
    this.#setups.set(setup.seasonId, setup);
    return structuredClone(setup);
  }
}

export class PostgresLiveDraftRoomSetupRepository implements LiveDraftRoomSetupRepository {
  constructor(private readonly client: PostgresQueryClient) {}

  async findForSeason(seasonId: string): Promise<LiveDraftRoomSetup | null> {
    const result = await this.client.query<LiveDraftRoomSetupPostgresRow>(`
SELECT league_season_id, source_version, player_catalog_json, initial_rosters_json,
       content_hash, updated_at
FROM league_season_draft_setups
WHERE league_season_id = $1;
`.trim(), [seasonId]);
    const row = result.rows[0];
    return row === undefined ? null : setupFromRow(row);
  }

  async save(input: SaveLiveDraftRoomSetupInput): Promise<LiveDraftRoomSetup> {
    const setup = setupFor(input);
    const result = await this.client.query<LiveDraftRoomSetupPostgresRow>(`
INSERT INTO league_season_draft_setups (
  league_season_id, source_version, player_catalog_json, initial_rosters_json,
  content_hash, created_at, updated_at
) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $6)
ON CONFLICT (league_season_id) DO UPDATE SET
  source_version = EXCLUDED.source_version,
  player_catalog_json = EXCLUDED.player_catalog_json,
  initial_rosters_json = EXCLUDED.initial_rosters_json,
  content_hash = EXCLUDED.content_hash,
  updated_at = EXCLUDED.updated_at
WHERE league_season_draft_setups.content_hash = EXCLUDED.content_hash
RETURNING league_season_id, source_version, player_catalog_json, initial_rosters_json,
          content_hash, updated_at;
`.trim(), [
      setup.seasonId,
      setup.sourceVersion,
      JSON.stringify(setup.playerCatalog),
      JSON.stringify(setup.initialRosters),
      setup.contentHash,
      setup.updatedAt,
    ]);
    const row = result.rows[0];
    if (row === undefined) {
      throw new Error(
        `Draft setup for season "${setup.seasonId}" already exists with different content. Use a new source version.`,
      );
    }
    return setupFromRow(row);
  }
}
