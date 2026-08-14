import type { PostgresQueryResult } from "../../../src/platform/postgresPlatformStore.js";
import type { PlatformPostgresState } from "./platformPostgresState.js";
import {
  cloneExportRow,
  dateValueAt,
  jsonValue,
  numberValueAt,
  stringValueAt,
  valueAt,
} from "./postgresRowUtilities.js";

export const platformPostgresExportQuery = (
  state: PlatformPostgresState,
  normalizedSql: string,
  values: readonly unknown[],
): PostgresQueryResult<unknown> | undefined => {
  if (normalizedSql.startsWith("SELECT e.*, c.content_base64 FROM draft_room_exports e")) {
    if (normalizedSql.includes("WHERE e.id = $1")) {
      const id = stringValueAt(values, 0);
      const row = state.exportRowWithContent(id);

      return { rows: row === undefined ? [] : [row] };
    }

    if (normalizedSql.includes("WHERE e.draft_room_id = $1")) {
      const roomId = stringValueAt(values, 0);
      const sourceRevision = numberValueAt(values, 1);
      const format = stringValueAt(values, 2);
      const exportRow = [...state.exports.values()].find(candidate =>
        candidate.draft_room_id === roomId &&
        candidate.source_revision === sourceRevision &&
        candidate.artifact_type === format &&
        candidate.status === "completed"
      );
      const row = exportRow === undefined ? undefined : state.exportRowWithContent(exportRow.id);

      return { rows: row === undefined ? [] : [row] };
    }
  }

  if (normalizedSql.startsWith("SELECT * FROM draft_room_exports WHERE draft_room_id = $1")) {
    const roomId = stringValueAt(values, 0);
    const rows = [...state.exports.values()]
      .filter(row => row.draft_room_id === roomId && row.status === "completed")
      .sort((left, right) => {
        const createdAtOrder = right.created_at.getTime() - left.created_at.getTime();
        if (createdAtOrder !== 0) return createdAtOrder;

        const revisionOrder = right.source_revision - left.source_revision;
        return revisionOrder === 0 ? left.id.localeCompare(right.id) : revisionOrder;
      })
      .map(row => cloneExportRow(row));

    return { rows };
  }

  if (normalizedSql.startsWith("INSERT INTO draft_room_exports")) {
    const id = stringValueAt(values, 0);
    const leagueId = stringValueAt(values, 1);
    const seasonId = stringValueAt(values, 2);
    const roomId = stringValueAt(values, 3);
    const createdByUserId = stringValueAt(values, 4);
    const artifactType = stringValueAt(values, 5);
    const storageKey = stringValueAt(values, 6);
    const payloadHash = stringValueAt(values, 7);
    const contentType = stringValueAt(values, 8);
    const byteLength = numberValueAt(values, 9);
    const sourceRevision = numberValueAt(values, 10);
    const metadataJson = valueAt(values, 11);
    const completedAt = dateValueAt(values, 12);
    if (state.exports.has(id)) return { rows: [], rowCount: 0 };

    state.exports.set(id, {
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

    return { rows: [{ id }], rowCount: 1 };
  }

  if (normalizedSql.startsWith("INSERT INTO draft_room_export_contents")) {
    const id = stringValueAt(values, 0);
    const artifactId = stringValueAt(values, 1);
    const contentBase64 = stringValueAt(values, 2);
    const createdAt = dateValueAt(values, 3);
    if (state.exportContents.has(id)) return { rows: [], rowCount: 0 };

    state.exportContents.set(id, {
      id,
      artifact_id: artifactId,
      content_base64: contentBase64,
      created_at: new Date(createdAt.getTime()),
    });

    return { rows: [], rowCount: 1 };
  }
  return undefined;
};
