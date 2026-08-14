import type { DraftExportResult } from "../draftExport.js";

export type ExportArtifactFormat = "csv";

export interface ExportArtifact {
  id: string;
  leagueId: string;
  seasonId: string;
  roomId: string;
  format: ExportArtifactFormat;
  sourceRevision: number;
  createdAt: Date;
  storageKey: string;
  sha256: string;
  byteLength: number;
  contentType: string;
}

export interface ExportArtifactContent {
  artifactId: string;
  contentBase64: string;
}

export interface CreateDraftExportArtifactInput {
  draftExport: DraftExportResult;
  leagueId: string;
  seasonId: string;
  roomId: string;
  sourceRevision: number;
  createdAt: Date;
}

export interface DraftExportArtifactResult {
  artifact: ExportArtifact;
  content: Buffer;
}

export type ExportArtifactRepositoryResult<T> = T | Promise<T>;

export interface SaveExportArtifactOptions {
  createdByUserId?: string | undefined;
}

export type ExportArtifactErrorCode = "artifact_conflict";

export interface ExportArtifactRepository {
  save(
    result: DraftExportArtifactResult,
    options?: SaveExportArtifactOptions | undefined,
  ): ExportArtifactRepositoryResult<DraftExportArtifactResult>;
  get(id: string): ExportArtifactRepositoryResult<DraftExportArtifactResult | undefined>;
  findByRoomRevision(
    roomId: string,
    sourceRevision: number,
    format?: ExportArtifactFormat,
  ): ExportArtifactRepositoryResult<DraftExportArtifactResult | undefined>;
  listByRoom(roomId: string): ExportArtifactRepositoryResult<readonly ExportArtifact[]>;
}
