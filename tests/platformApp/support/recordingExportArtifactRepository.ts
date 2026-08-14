import type {
  DraftExportArtifactResult,
  ExportArtifact,
  ExportArtifactFormat,
  ExportArtifactRepository,
  SaveExportArtifactOptions,
} from "../../../src/platform/exportArtifacts.js";

export class RecordingExportArtifactRepository implements ExportArtifactRepository {
  savedByUserIds: string[] = [];
  savedResults: DraftExportArtifactResult[] = [];

  async save(
    result: DraftExportArtifactResult,
    options?: SaveExportArtifactOptions,
  ): Promise<DraftExportArtifactResult> {
    this.savedByUserIds.push(options?.createdByUserId ?? "");
    this.savedResults.push({
      artifact: structuredClone(result.artifact),
      content: Buffer.from(result.content),
    });

    return {
      artifact: structuredClone(result.artifact),
      content: Buffer.from(result.content),
    };
  }

  async get(_id: string): Promise<DraftExportArtifactResult | undefined> {
    return undefined;
  }

  async findByRoomRevision(
    _roomId: string,
    _sourceRevision: number,
    _format?: ExportArtifactFormat,
  ): Promise<DraftExportArtifactResult | undefined> {
    return undefined;
  }

  async listByRoom(_roomId: string): Promise<readonly ExportArtifact[]> {
    return [];
  }
}
