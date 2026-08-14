import type {
  DraftExportArtifactResult,
  ExportArtifact,
} from "./contracts.js";

export const cloneArtifact = (artifact: ExportArtifact): ExportArtifact => ({
  ...artifact,
  createdAt: new Date(artifact.createdAt.getTime()),
});

export const cloneArtifactResult = (
  result: DraftExportArtifactResult,
): DraftExportArtifactResult => ({
  artifact: cloneArtifact(result.artifact),
  content: Buffer.from(result.content),
});
