import type {
  DraftExportArtifactResult,
  ExportArtifact,
  ExportArtifactFormat,
} from "../exportArtifacts.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type {
  DraftRoomExportRow,
  DraftRoomExportWithContentRow,
} from "./contracts.js";
import { firstRow } from "./databaseValues.js";
import { artifactFromRow, resultFromRow } from "./rowCodec.js";
import {
  artifactByIdSql,
  artifactByRoomRevisionSql,
  artifactsByRoomSql,
} from "./sql.js";

export const getArtifact = async (
  client: PostgresQueryClient,
  id: string,
): Promise<DraftExportArtifactResult | undefined> => {
  const result = await client.query<DraftRoomExportWithContentRow>(artifactByIdSql, [id]);
  const row = firstRow(result);
  return row === undefined ? undefined : resultFromRow(row);
};

export const findArtifactByRoomRevision = async (
  client: PostgresQueryClient,
  roomId: string,
  sourceRevision: number,
  format: ExportArtifactFormat,
): Promise<DraftExportArtifactResult | undefined> => {
  const result = await client.query<DraftRoomExportWithContentRow>(
    artifactByRoomRevisionSql,
    [roomId, sourceRevision, format],
  );
  const row = firstRow(result);
  return row === undefined ? undefined : resultFromRow(row);
};

export const listArtifactsByRoom = async (
  client: PostgresQueryClient,
  roomId: string,
): Promise<readonly ExportArtifact[]> => {
  const result = await client.query<DraftRoomExportRow>(artifactsByRoomSql, [roomId]);
  return result.rows.map(artifactFromRow);
};
