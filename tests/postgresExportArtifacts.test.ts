import { describe, expect, it } from "vitest";
import type { DraftExportResult } from "../src/platform/draftExport.js";
import {
  ExportArtifactError,
  createDraftExportArtifact,
} from "../src/platform/exportArtifacts.js";
import { PostgresExportArtifactRepository } from "../src/platform/postgresExportArtifacts.js";
import type { PostgresTransactionalQueryClient } from "../src/platform/postgresJobQueue.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";

const createdAt = new Date("2026-08-09T15:30:00.000Z");

const draftExportResult: DraftExportResult = {
  sheetName: "Draft Results",
  table: [
    ["Slot", "Player", "Price"],
    ["QB", "Jayden Daniels", 25],
  ],
  csv: "Slot,Player,Price\nQB,Jayden Daniels,25\n",
};

const artifactInput = {
  draftExport: draftExportResult,
  leagueId: "league_214674",
  seasonId: "season_2026",
  roomId: "room_final",
  sourceRevision: 7,
  createdAt,
} as const;

interface DraftRoomExportRow {
  id: string;
  league_id: string;
  league_season_id: string;
  draft_room_id: string;
  created_by_user_id: string;
  artifact_type: string;
  status: string;
  storage_key: string | null;
  payload_hash: string;
  content_type: string;
  byte_length: number;
  source_revision: number;
  metadata_json: unknown;
  created_at: Date;
  completed_at: Date | null;
}

interface DraftRoomExportContentRow {
  id: string;
  artifact_id: string;
  content_base64: string;
  created_at: Date;
}

const normalizeSql = (text: string): string => text.replace(/\s+/g, " ").trim();

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const jsonValue = (value: unknown): unknown => typeof value === "string"
  ? JSON.parse(value)
  : cloneJson(value);

const cloneExportRow = (row: DraftRoomExportRow): DraftRoomExportRow => ({
  ...row,
  metadata_json: jsonValue(row.metadata_json),
  created_at: new Date(row.created_at.getTime()),
  completed_at: row.completed_at === null ? null : new Date(row.completed_at.getTime()),
});

const cloneContentRow = (row: DraftRoomExportContentRow): DraftRoomExportContentRow => ({
  ...row,
  created_at: new Date(row.created_at.getTime()),
});

class FakePostgresExportArtifactClient implements PostgresTransactionalQueryClient {
  readonly exports = new Map<string, DraftRoomExportRow>();
  readonly contents = new Map<string, DraftRoomExportContentRow>();
  readonly queries: Array<{ text: string; values: readonly unknown[]; inTransaction: boolean }> = [];
  transactionCount = 0;

  #inTransaction = false;

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    const exportsBackup = new Map([...this.exports].map(([id, row]) => [id, cloneExportRow(row)]));
    const contentsBackup = new Map([...this.contents].map(([id, row]) => [id, cloneContentRow(row)]));

    this.#inTransaction = true;
    try {
      return await operation(this);
    } catch (error) {
      this.exports.clear();
      for (const [id, row] of exportsBackup) this.exports.set(id, row);
      this.contents.clear();
      for (const [id, row] of contentsBackup) this.contents.set(id, row);
      throw error;
    } finally {
      this.#inTransaction = false;
    }
  }

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    this.queries.push({ text, values, inTransaction: this.#inTransaction });
    const normalizedSql = normalizeSql(text);

    if (normalizedSql.startsWith("SELECT e.*, c.content_base64 FROM draft_room_exports e")) {
      if (normalizedSql.includes("WHERE e.id = $1")) {
        const [id] = values as readonly [string];
        const row = this.rowWithContent(id);

        return { rows: row === undefined ? [] : [row as TRow] };
      }

      if (normalizedSql.includes("WHERE e.draft_room_id = $1")) {
        const [roomId, sourceRevision, format] = values as readonly [string, number, string];
        const exportRow = [...this.exports.values()].find(candidate =>
          candidate.draft_room_id === roomId &&
          candidate.source_revision === sourceRevision &&
          candidate.artifact_type === format &&
          candidate.status === "completed"
        );
        const row = exportRow === undefined ? undefined : this.rowWithContent(exportRow.id);

        return { rows: row === undefined ? [] : [row as TRow] };
      }
    }

    if (normalizedSql.startsWith("SELECT * FROM draft_room_exports WHERE draft_room_id = $1")) {
      const [roomId] = values as readonly [string];
      const rows = [...this.exports.values()]
        .filter(row => row.draft_room_id === roomId && row.status === "completed")
        .sort((left, right) => {
          const createdAtOrder = right.created_at.getTime() - left.created_at.getTime();
          if (createdAtOrder !== 0) return createdAtOrder;

          const revisionOrder = right.source_revision - left.source_revision;
          return revisionOrder === 0 ? left.id.localeCompare(right.id) : revisionOrder;
        })
        .map(row => cloneExportRow(row) as TRow);

      return { rows };
    }

    if (normalizedSql.startsWith("INSERT INTO draft_room_exports")) {
      const [
        id,
        leagueId,
        seasonId,
        roomId,
        createdByUserId,
        artifactType,
        storageKey,
        payloadHash,
        contentType,
        byteLength,
        sourceRevision,
        metadataJson,
        completedAt,
      ] = values as readonly [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        number,
        number,
        unknown,
        Date,
      ];
      if (this.exports.has(id)) return { rows: [], rowCount: 0 };

      this.exports.set(id, {
        id,
        league_id: leagueId,
        league_season_id: seasonId,
        draft_room_id: roomId,
        created_by_user_id: createdByUserId,
        artifact_type: artifactType,
        status: "completed",
        storage_key: storageKey,
        payload_hash: payloadHash,
        content_type: contentType,
        byte_length: byteLength,
        source_revision: sourceRevision,
        metadata_json: jsonValue(metadataJson),
        created_at: new Date(completedAt.getTime()),
        completed_at: new Date(completedAt.getTime()),
      });

      return { rows: [{ id } as TRow], rowCount: 1 };
    }

    if (normalizedSql.startsWith("INSERT INTO draft_room_export_contents")) {
      const [id, artifactId, contentBase64, createdAtValue] =
        values as readonly [string, string, string, Date];
      if (this.contents.has(id)) return { rows: [], rowCount: 0 };

      this.contents.set(id, {
        id,
        artifact_id: artifactId,
        content_base64: contentBase64,
        created_at: new Date(createdAtValue.getTime()),
      });

      return { rows: [], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL: ${text}`);
  }

  private rowWithContent(id: string): Record<string, unknown> | undefined {
    const exportRow = this.exports.get(id);
    const content = [...this.contents.values()].find(candidate => candidate.artifact_id === id);
    if (exportRow === undefined || content === undefined) return undefined;

    return {
      ...cloneExportRow(exportRow),
      content_base64: content.content_base64,
    };
  }
}

describe("Postgres export artifacts", () => {
  it("saves and reloads a completed draft room CSV export with content", async () => {
    const client = new FakePostgresExportArtifactClient();
    const repository = new PostgresExportArtifactRepository(client);
    const artifactResult = createDraftExportArtifact(artifactInput);

    const saved = await repository.save(artifactResult, { createdByUserId: "user_commish" });
    const reloaded = await new PostgresExportArtifactRepository(client).get(artifactResult.artifact.id);

    expect(reloaded).toEqual(saved);
    expect(saved.content.toString("utf8")).toBe(draftExportResult.csv);
    expect(client.exports.get(artifactResult.artifact.id)).toMatchObject({
      league_id: "league_214674",
      league_season_id: "season_2026",
      draft_room_id: "room_final",
      created_by_user_id: "user_commish",
      artifact_type: "csv",
      status: "completed",
      payload_hash: artifactResult.artifact.sha256,
      byte_length: artifactResult.artifact.byteLength,
      source_revision: 7,
    });
    expect([...client.contents.values()]).toEqual([
      {
        id: `${artifactResult.artifact.id}:content`,
        artifact_id: artifactResult.artifact.id,
        content_base64: artifactResult.content.toString("base64"),
        created_at: createdAt,
      },
    ]);
  });

  it("returns the existing artifact for the same room revision and format", async () => {
    const client = new FakePostgresExportArtifactClient();
    const repository = new PostgresExportArtifactRepository(client);
    const artifactResult = createDraftExportArtifact(artifactInput);
    const replay = createDraftExportArtifact({
      ...artifactInput,
      createdAt: new Date("2026-08-09T16:00:00.000Z"),
    });

    const saved = await repository.save(artifactResult, { createdByUserId: "user_commish" });
    const replayed = await repository.save(replay, { createdByUserId: "user_commish" });

    expect(replayed).toEqual(saved);
    expect(client.exports).toHaveLength(1);
    expect(client.contents).toHaveLength(1);
    await expect(repository.findByRoomRevision("room_final", 7)).resolves.toEqual(saved);
  });

  it("rejects the same artifact id when the stored payload hash differs", async () => {
    const client = new FakePostgresExportArtifactClient();
    const repository = new PostgresExportArtifactRepository(client);
    const artifactResult = createDraftExportArtifact(artifactInput);
    const conflicting = createDraftExportArtifact({
      ...artifactInput,
      draftExport: {
        ...draftExportResult,
        csv: `${draftExportResult.csv}RB,Bijan Robinson,70\n`,
      },
    });

    await repository.save(artifactResult, { createdByUserId: "user_commish" });

    await expect(repository.save(conflicting, { createdByUserId: "user_commish" })).rejects.toThrow(
      new ExportArtifactError(
        "artifact_conflict",
        "An export artifact already exists for this id with different content.",
      ),
    );
    expect(client.exports).toHaveLength(1);
    expect(client.contents).toHaveLength(1);
  });

  it("lists room artifacts newest first and filters other rooms", async () => {
    const client = new FakePostgresExportArtifactClient();
    const repository = new PostgresExportArtifactRepository(client);
    const older = createDraftExportArtifact({
      ...artifactInput,
      sourceRevision: 6,
      createdAt: new Date("2026-08-09T15:00:00.000Z"),
    });
    const newer = createDraftExportArtifact({
      ...artifactInput,
      sourceRevision: 8,
      createdAt: new Date("2026-08-09T16:00:00.000Z"),
    });
    const otherRoom = createDraftExportArtifact({
      ...artifactInput,
      roomId: "room_consolation",
      sourceRevision: 1,
      createdAt: new Date("2026-08-09T17:00:00.000Z"),
    });

    await repository.save(older, { createdByUserId: "user_commish" });
    await repository.save(otherRoom, { createdByUserId: "user_commish" });
    await repository.save(newer, { createdByUserId: "user_commish" });

    await expect(repository.listByRoom("room_final")).resolves.toEqual([
      newer.artifact,
      older.artifact,
    ]);
  });
});
