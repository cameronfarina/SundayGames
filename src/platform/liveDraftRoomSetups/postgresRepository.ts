import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type {
  LiveDraftRoomSetup,
  LiveDraftRoomSetupPostgresRow,
  LiveDraftRoomSetupRepository,
  SaveLiveDraftRoomSetupInput,
} from "./contracts.js";
import { LiveDraftRoomSetupWriteConflictError } from "./errors.js";
import { setupFromRow } from "./rowCodec.js";
import { setupFor } from "./setup.js";

const returnedColumns = `league_season_id, source_version, player_catalog_json, initial_rosters_json,
          content_hash, updated_at`;

export class PostgresLiveDraftRoomSetupRepository implements LiveDraftRoomSetupRepository {
  constructor(private readonly client: PostgresQueryClient) {}

  async findForSeason(seasonId: string): Promise<LiveDraftRoomSetup | null> {
    const result = await this.client.query<LiveDraftRoomSetupPostgresRow>(`
SELECT ${returnedColumns}
FROM league_season_draft_setups
WHERE league_season_id = $1;
`.trim(), [seasonId]);
    const row = result.rows[0];
    return row === undefined ? null : setupFromRow(row);
  }

  async save(
    input: SaveLiveDraftRoomSetupInput,
    options: { expectedContentHash?: string | null | undefined } = {},
  ): Promise<LiveDraftRoomSetup> {
    const setup = setupFor(input);
    const expectedContentHash = options.expectedContentHash;
    const result = typeof expectedContentHash === "string"
      ? await this.client.query<LiveDraftRoomSetupPostgresRow>(`
UPDATE league_season_draft_setups SET
  source_version = $2, player_catalog_json = $3::jsonb, initial_rosters_json = $4::jsonb,
  content_hash = $5, updated_at = $6
WHERE league_season_id = $1 AND content_hash = $7
RETURNING ${returnedColumns};
`.trim(), updateParameters(setup, expectedContentHash))
      : await this.client.query<LiveDraftRoomSetupPostgresRow>(`
INSERT INTO league_season_draft_setups (
  league_season_id, source_version, player_catalog_json, initial_rosters_json,
  content_hash, created_at, updated_at
) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $6)
ON CONFLICT (league_season_id) ${expectedContentHash === null ? "DO NOTHING" : updateClause}
RETURNING ${returnedColumns};
`.trim(), insertParameters(setup));
    const row = result.rows[0];
    if (row === undefined) throw new LiveDraftRoomSetupWriteConflictError();
    return setupFromRow(row);
  }
}

const updateClause = `DO UPDATE SET
  source_version = EXCLUDED.source_version,
  player_catalog_json = EXCLUDED.player_catalog_json,
  initial_rosters_json = EXCLUDED.initial_rosters_json,
  content_hash = EXCLUDED.content_hash,
  updated_at = EXCLUDED.updated_at`;

const insertParameters = (setup: LiveDraftRoomSetup): readonly unknown[] => [
  setup.seasonId,
  setup.sourceVersion,
  JSON.stringify(setup.playerCatalog),
  JSON.stringify(setup.initialRosters),
  setup.contentHash,
  setup.updatedAt,
];

const updateParameters = (
  setup: LiveDraftRoomSetup,
  expectedContentHash: string,
): readonly unknown[] => [...insertParameters(setup), expectedContentHash];
