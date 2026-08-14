import { csvContentType, draftExportFormat } from "./constants.js";
import type {
  CreateDraftExportArtifactInput,
  DraftExportArtifactResult,
} from "./contracts.js";
import { sha256For } from "./hashing.js";
import { draftExportArtifactId, draftExportStorageKey } from "./identity.js";

export const createDraftExportArtifact = (
  input: CreateDraftExportArtifactInput,
): DraftExportArtifactResult => {
  const content = Buffer.from(input.draftExport.csv, "utf8");

  return {
    artifact: {
      id: draftExportArtifactId(
        input.leagueId,
        input.seasonId,
        input.roomId,
        input.sourceRevision,
      ),
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      roomId: input.roomId,
      format: draftExportFormat,
      sourceRevision: input.sourceRevision,
      createdAt: new Date(input.createdAt.getTime()),
      storageKey: draftExportStorageKey(
        input.leagueId,
        input.seasonId,
        input.roomId,
        input.sourceRevision,
      ),
      sha256: sha256For(content),
      byteLength: content.byteLength,
      contentType: csvContentType,
    },
    content,
  };
};
