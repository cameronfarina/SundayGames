import { ExportArtifactError } from "../exportArtifacts.js";
import type { DraftExportArtifactResult } from "../exportArtifacts.js";

export const artifactConflict = (): ExportArtifactError =>
  new ExportArtifactError(
    "artifact_conflict",
    "An export artifact already exists for this id with different content.",
  );

export const assertSameArtifactContent = (
  existing: DraftExportArtifactResult,
  incoming: DraftExportArtifactResult,
): void => {
  if (existing.artifact.sha256 !== incoming.artifact.sha256) throw artifactConflict();
};
