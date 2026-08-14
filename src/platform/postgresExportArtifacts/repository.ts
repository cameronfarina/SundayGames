import type {
  DraftExportArtifactResult,
  ExportArtifact,
  ExportArtifactFormat,
  ExportArtifactRepository,
  SaveExportArtifactOptions,
} from "../exportArtifacts.js";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import {
  findArtifactByRoomRevision,
  getArtifact,
  listArtifactsByRoom,
} from "./readRepository.js";
import { saveArtifact } from "./writeRepository.js";

const defaultFormat: ExportArtifactFormat = "csv";

export class PostgresExportArtifactRepository implements ExportArtifactRepository {
  constructor(readonly client: PostgresTransactionalQueryClient) {}

  async save(
    result: DraftExportArtifactResult,
    options?: SaveExportArtifactOptions | undefined,
  ): Promise<DraftExportArtifactResult> {
    return await saveArtifact(this.client, result, options);
  }

  async get(id: string): Promise<DraftExportArtifactResult | undefined> {
    return await getArtifact(this.client, id);
  }

  async findByRoomRevision(
    roomId: string,
    sourceRevision: number,
    format: ExportArtifactFormat = defaultFormat,
  ): Promise<DraftExportArtifactResult | undefined> {
    return await findArtifactByRoomRevision(this.client, roomId, sourceRevision, format);
  }

  async listByRoom(roomId: string): Promise<readonly ExportArtifact[]> {
    return await listArtifactsByRoom(this.client, roomId);
  }
}
