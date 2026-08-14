import type {
  DraftExportArtifactResult,
  SaveExportArtifactOptions,
} from "../exportArtifacts.js";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import { firstRow, jsonbParameter } from "./databaseValues.js";
import { artifactConflict, assertSameArtifactContent } from "./errors.js";
import { requireCreatedByUserId } from "./options.js";
import { getArtifact } from "./readRepository.js";
import { insertArtifactContentSql, insertArtifactSql } from "./sql.js";

const artifactParameters = (
  result: DraftExportArtifactResult,
  createdByUserId: string,
): readonly unknown[] => [
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
];

export const saveArtifact = async (
  client: PostgresTransactionalQueryClient,
  result: DraftExportArtifactResult,
  options: SaveExportArtifactOptions | undefined,
): Promise<DraftExportArtifactResult> => {
  const existing = await getArtifact(client, result.artifact.id);
  if (existing !== undefined) {
    assertSameArtifactContent(existing, result);
    return existing;
  }
  const createdByUserId = requireCreatedByUserId(options);

  return await client.transaction(async transaction => {
    const inserted = await transaction.query<{ id: string }>(
      insertArtifactSql,
      artifactParameters(result, createdByUserId),
    );
    if (firstRow(inserted) === undefined) {
      const stored = await getArtifact(transaction, result.artifact.id);
      if (stored === undefined) throw artifactConflict();
      assertSameArtifactContent(stored, result);
      return stored;
    }

    await transaction.query(insertArtifactContentSql, [
      `${result.artifact.id}:content`,
      result.artifact.id,
      result.content.toString("base64"),
      result.artifact.createdAt,
    ]);
    const stored = await getArtifact(transaction, result.artifact.id);
    if (stored === undefined) throw new Error(`Export artifact ${result.artifact.id} was not stored.`);
    return stored;
  });
};
