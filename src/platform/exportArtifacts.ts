import { createHash } from "node:crypto";
import type { DraftExportResult } from "./draftExport.js";

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

export type ExportArtifactErrorCode = "artifact_conflict";

export class ExportArtifactError extends Error {
  readonly code: ExportArtifactErrorCode;

  constructor(code: ExportArtifactErrorCode, message: string) {
    super(message);
    this.name = "ExportArtifactError";
    this.code = code;
  }
}

export interface ExportArtifactRepository {
  save(result: DraftExportArtifactResult): DraftExportArtifactResult;
  get(id: string): DraftExportArtifactResult | undefined;
  findByRoomRevision(
    roomId: string,
    sourceRevision: number,
    format?: ExportArtifactFormat,
  ): DraftExportArtifactResult | undefined;
  listByRoom(roomId: string): readonly ExportArtifact[];
}

const draftExportFormat = "csv" satisfies ExportArtifactFormat;
const csvContentType = "text/csv; charset=utf-8";

const storageSegment = (value: string): string => encodeURIComponent(value.trim());

const draftExportArtifactId = (
  leagueId: string,
  seasonId: string,
  roomId: string,
  sourceRevision: number,
): string =>
  `draft-room-export:${leagueId}:${seasonId}:${roomId}:rev${sourceRevision}:${draftExportFormat}`;

const draftExportStorageKey = (
  leagueId: string,
  seasonId: string,
  roomId: string,
  sourceRevision: number,
): string =>
  [
    "exports",
    storageSegment(leagueId),
    storageSegment(seasonId),
    storageSegment(roomId),
    `rev${sourceRevision}.${draftExportFormat}`,
  ].join("/");

const sha256For = (content: Buffer): string =>
  createHash("sha256").update(content).digest("hex");

const cloneArtifact = (artifact: ExportArtifact): ExportArtifact => ({
  ...artifact,
  createdAt: new Date(artifact.createdAt.getTime()),
});

const cloneArtifactResult = (result: DraftExportArtifactResult): DraftExportArtifactResult => ({
  artifact: cloneArtifact(result.artifact),
  content: Buffer.from(result.content),
});

export const createDraftExportArtifact = (
  input: CreateDraftExportArtifactInput,
): DraftExportArtifactResult => {
  const content = Buffer.from(input.draftExport.csv, "utf8");

  return {
    artifact: {
      id: draftExportArtifactId(input.leagueId, input.seasonId, input.roomId, input.sourceRevision),
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      roomId: input.roomId,
      format: draftExportFormat,
      sourceRevision: input.sourceRevision,
      createdAt: new Date(input.createdAt.getTime()),
      storageKey: draftExportStorageKey(input.leagueId, input.seasonId, input.roomId, input.sourceRevision),
      sha256: sha256For(content),
      byteLength: content.byteLength,
      contentType: csvContentType,
    },
    content,
  };
};

export class InMemoryExportArtifactRepository implements ExportArtifactRepository {
  readonly #artifactsById = new Map<string, ExportArtifact>();
  readonly #contentsByArtifactId = new Map<string, Buffer>();

  save(result: DraftExportArtifactResult): DraftExportArtifactResult {
    const existing = this.get(result.artifact.id);

    if (existing !== undefined) {
      if (existing.artifact.sha256 !== result.artifact.sha256) {
        throw new ExportArtifactError(
          "artifact_conflict",
          "An export artifact already exists for this id with different content.",
        );
      }

      return existing;
    }

    const storedArtifact = cloneArtifact(result.artifact);
    this.#artifactsById.set(storedArtifact.id, storedArtifact);
    this.#contentsByArtifactId.set(storedArtifact.id, Buffer.from(result.content));

    return cloneArtifactResult({ artifact: storedArtifact, content: result.content });
  }

  get(id: string): DraftExportArtifactResult | undefined {
    const artifact = this.#artifactsById.get(id);
    const content = this.#contentsByArtifactId.get(id);

    return artifact === undefined || content === undefined
      ? undefined
      : cloneArtifactResult({ artifact, content });
  }

  findByRoomRevision(
    roomId: string,
    sourceRevision: number,
    format: ExportArtifactFormat = draftExportFormat,
  ): DraftExportArtifactResult | undefined {
    const artifact = [...this.#artifactsById.values()].find(candidate =>
      candidate.roomId === roomId
        && candidate.sourceRevision === sourceRevision
        && candidate.format === format
    );

    return artifact === undefined ? undefined : this.get(artifact.id);
  }

  listByRoom(roomId: string): readonly ExportArtifact[] {
    return [...this.#artifactsById.values()]
      .filter(artifact => artifact.roomId === roomId)
      .sort((left, right) => {
        const createdAtOrder = right.createdAt.getTime() - left.createdAt.getTime();
        if (createdAtOrder !== 0) return createdAtOrder;

        const revisionOrder = right.sourceRevision - left.sourceRevision;
        return revisionOrder === 0 ? left.id.localeCompare(right.id) : revisionOrder;
      })
      .map(cloneArtifact);
  }

  artifacts(): readonly ExportArtifact[] {
    return [...this.#artifactsById.values()].map(cloneArtifact);
  }

  contents(): readonly ExportArtifactContent[] {
    return [...this.#contentsByArtifactId].map(([artifactId, content]) => ({
      artifactId,
      contentBase64: content.toString("base64"),
    }));
  }

  replaceArtifactsAndContents(
    artifacts: readonly ExportArtifact[],
    contents: readonly ExportArtifactContent[],
  ): void {
    this.#artifactsById.clear();
    this.#contentsByArtifactId.clear();
    const contentByArtifactId = new Map(contents.map(content => [content.artifactId, content.contentBase64]));

    for (const artifact of artifacts) {
      const contentBase64 = contentByArtifactId.get(artifact.id);
      if (contentBase64 === undefined) continue;

      this.#artifactsById.set(artifact.id, cloneArtifact(artifact));
      this.#contentsByArtifactId.set(artifact.id, Buffer.from(contentBase64, "base64"));
    }
  }
}
