import { cloneArtifact, cloneArtifactResult } from "./cloning.js";
import { draftExportFormat } from "./constants.js";
import type {
  DraftExportArtifactResult,
  ExportArtifact,
  ExportArtifactContent,
  ExportArtifactFormat,
  ExportArtifactRepository,
  SaveExportArtifactOptions,
} from "./contracts.js";
import { assertSameArtifactContent } from "./errors.js";

export class InMemoryExportArtifactRepository implements ExportArtifactRepository {
  readonly #artifactsById = new Map<string, ExportArtifact>();
  readonly #contentsByArtifactId = new Map<string, Buffer>();

  save(
    result: DraftExportArtifactResult,
    _options?: SaveExportArtifactOptions | undefined,
  ): DraftExportArtifactResult {
    const existing = this.get(result.artifact.id);
    if (existing !== undefined) {
      assertSameArtifactContent(existing, result);
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
    const contentByArtifactId = new Map(
      contents.map(content => [content.artifactId, content.contentBase64]),
    );

    for (const artifact of artifacts) {
      const contentBase64 = contentByArtifactId.get(artifact.id);
      if (contentBase64 === undefined) continue;
      this.#artifactsById.set(artifact.id, cloneArtifact(artifact));
      this.#contentsByArtifactId.set(artifact.id, Buffer.from(contentBase64, "base64"));
    }
  }
}
