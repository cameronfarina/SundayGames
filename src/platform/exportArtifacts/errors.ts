import type {
  DraftExportArtifactResult,
  ExportArtifactErrorCode,
} from "./contracts.js";

export class ExportArtifactError extends Error {
  readonly code: ExportArtifactErrorCode;

  constructor(code: ExportArtifactErrorCode, message: string) {
    super(message);
    this.name = "ExportArtifactError";
    this.code = code;
  }
}

export const assertSameArtifactContent = (
  existing: DraftExportArtifactResult,
  incoming: DraftExportArtifactResult,
): void => {
  if (existing.artifact.sha256 !== incoming.artifact.sha256) {
    throw new ExportArtifactError(
      "artifact_conflict",
      "An export artifact already exists for this id with different content.",
    );
  }
};
