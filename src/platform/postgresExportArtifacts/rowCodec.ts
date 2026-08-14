import type {
  DraftExportArtifactResult,
  ExportArtifact,
  ExportArtifactFormat,
} from "../exportArtifacts.js";
import type {
  DraftRoomExportRow,
  DraftRoomExportWithContentRow,
} from "./contracts.js";
import { dateFromDb } from "./databaseValues.js";

const formatFromDb = (value: string): ExportArtifactFormat => {
  if (value !== "csv") throw new Error(`Unsupported export artifact format: ${value}`);
  return value;
};

export const artifactFromRow = (row: DraftRoomExportRow): ExportArtifact => ({
  id: row.id,
  leagueId: row.league_id,
  seasonId: row.league_season_id,
  roomId: row.draft_room_id,
  format: formatFromDb(row.artifact_type),
  sourceRevision: row.source_revision,
  createdAt: dateFromDb(row.created_at),
  storageKey: row.storage_key ?? "",
  sha256: row.payload_hash,
  byteLength: row.byte_length,
  contentType: row.content_type,
});

export const resultFromRow = (
  row: DraftRoomExportWithContentRow,
): DraftExportArtifactResult => ({
  artifact: artifactFromRow(row),
  content: Buffer.from(row.content_base64, "base64"),
});
