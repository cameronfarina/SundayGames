import {
  ExportArtifactError,
  type ExportArtifactRepository,
  type DraftExportArtifactResult,
  type ExportArtifact,
  type ExportArtifactFormat,
  type SaveExportArtifactOptions,
} from "./exportArtifacts.js";
import type { PostgresTransactionalQueryClient } from "./postgresJobQueue.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "./postgresPlatformStore.js";

interface DraftRoomExportWithContentRow {
  id: string;
  league_id: string;
  league_season_id: string;
  draft_room_id: string;
  artifact_type: string;
  storage_key: string | null;
  payload_hash: string;
  content_type: string;
  byte_length: number;
  source_revision: number;
  created_at: Date | string;
  content_base64: string;
}

type DraftRoomExportRow = Omit<DraftRoomExportWithContentRow, "content_base64">;

const defaultFormat = "csv" satisfies ExportArtifactFormat;

const firstRow = <TRow>(result: PostgresQueryResult<TRow>): TRow | undefined => result.rows[0];

const jsonbParameter = (value: unknown): string => JSON.stringify(value);

const dateFromDb = (value: Date | string): Date =>
  value instanceof Date ? new Date(value.getTime()) : new Date(value);

const artifactFromRow = (row: DraftRoomExportRow): ExportArtifact => ({
  id: row.id,
  leagueId: row.league_id,
  seasonId: row.league_season_id,
  roomId: row.draft_room_id,
  format: row.artifact_type as ExportArtifactFormat,
  sourceRevision: row.source_revision,
  createdAt: dateFromDb(row.created_at),
  storageKey: row.storage_key ?? "",
  sha256: row.payload_hash,
  byteLength: row.byte_length,
  contentType: row.content_type,
});

const resultFromRow = (row: DraftRoomExportWithContentRow): DraftExportArtifactResult => ({
  artifact: artifactFromRow(row),
  content: Buffer.from(row.content_base64, "base64"),
});

const artifactConflict = (): ExportArtifactError =>
  new ExportArtifactError(
    "artifact_conflict",
    "An export artifact already exists for this id with different content.",
  );

const assertSameArtifactContent = (
  existing: DraftExportArtifactResult,
  incoming: DraftExportArtifactResult,
): void => {
  if (existing.artifact.sha256 !== incoming.artifact.sha256) {
    throw artifactConflict();
  }
};

const requireCreatedByUserId = (options: SaveExportArtifactOptions | undefined): string => {
  const createdByUserId = options?.createdByUserId;
  if (createdByUserId === undefined || createdByUserId.trim().length === 0) {
    throw new Error("createdByUserId is required when saving Postgres export artifacts.");
  }

  return createdByUserId;
};

const getArtifact = async (
  client: PostgresQueryClient,
  id: string,
): Promise<DraftExportArtifactResult | undefined> => {
  const result = await client.query<DraftRoomExportWithContentRow>(
    `
SELECT e.*, c.content_base64
FROM draft_room_exports e
JOIN draft_room_export_contents c ON c.artifact_id = e.id
WHERE e.id = $1
LIMIT 1
`.trim(),
    [id],
  );
  const row = firstRow(result);

  return row === undefined ? undefined : resultFromRow(row);
};

export class PostgresExportArtifactRepository implements ExportArtifactRepository {
  constructor(readonly client: PostgresTransactionalQueryClient) {}

  async save(
    result: DraftExportArtifactResult,
    options?: SaveExportArtifactOptions | undefined,
  ): Promise<DraftExportArtifactResult> {
    const existing = await getArtifact(this.client, result.artifact.id);
    if (existing !== undefined) {
      assertSameArtifactContent(existing, result);

      return existing;
    }
    const createdByUserId = requireCreatedByUserId(options);

    return await this.client.transaction(async client => {
      const insertResult = await client.query<{ id: string }>(
        `
INSERT INTO draft_room_exports (
  id,
  league_id,
  league_season_id,
  draft_room_id,
  created_by_user_id,
  artifact_type,
  status,
  storage_key,
  payload_hash,
  content_type,
  byte_length,
  source_revision,
  metadata_json,
  created_at,
  completed_at
) VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7, $8, $9, $10, $11, $12::jsonb, $13, $13)
ON CONFLICT (id) DO NOTHING
RETURNING id
`.trim(),
        [
          result.artifact.id,
          result.artifact.leagueId,
          result.artifact.seasonId,
          result.artifact.roomId,
          createdByUserId,
          result.artifact.format,
          result.artifact.storageKey,
          result.artifact.sha256,
          result.artifact.contentType,
          result.artifact.byteLength,
          result.artifact.sourceRevision,
          jsonbParameter({ sheetName: "Draft Results" }),
          result.artifact.createdAt,
        ],
      );

      if (firstRow(insertResult) === undefined) {
        const stored = await getArtifact(client, result.artifact.id);
        if (stored === undefined) throw artifactConflict();
        assertSameArtifactContent(stored, result);

        return stored;
      }

      await client.query(
        `
INSERT INTO draft_room_export_contents (
  id,
  artifact_id,
  content_base64,
  created_at
) VALUES ($1, $2, $3, $4)
ON CONFLICT (artifact_id) DO NOTHING
`.trim(),
        [
          `${result.artifact.id}:content`,
          result.artifact.id,
          result.content.toString("base64"),
          result.artifact.createdAt,
        ],
      );

      const stored = await getArtifact(client, result.artifact.id);
      if (stored === undefined) throw new Error(`Export artifact ${result.artifact.id} was not stored.`);

      return stored;
    });
  }

  async get(id: string): Promise<DraftExportArtifactResult | undefined> {
    return await getArtifact(this.client, id);
  }

  async findByRoomRevision(
    roomId: string,
    sourceRevision: number,
    format: ExportArtifactFormat = defaultFormat,
  ): Promise<DraftExportArtifactResult | undefined> {
    const result = await this.client.query<DraftRoomExportWithContentRow>(
      `
SELECT e.*, c.content_base64
FROM draft_room_exports e
JOIN draft_room_export_contents c ON c.artifact_id = e.id
WHERE e.draft_room_id = $1
  AND e.source_revision = $2
  AND e.artifact_type = $3
  AND e.status = 'completed'
LIMIT 1
`.trim(),
      [roomId, sourceRevision, format],
    );
    const row = firstRow(result);

    return row === undefined ? undefined : resultFromRow(row);
  }

  async listByRoom(roomId: string): Promise<readonly ExportArtifact[]> {
    const result = await this.client.query<DraftRoomExportRow>(
      `
SELECT *
FROM draft_room_exports
WHERE draft_room_id = $1
  AND status = 'completed'
ORDER BY created_at DESC, source_revision DESC, id ASC
`.trim(),
      [roomId],
    );

    return result.rows.map(artifactFromRow);
  }
}
