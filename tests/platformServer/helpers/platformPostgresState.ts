import type {
  DraftRoomEventRow,
  DraftRoomExportContentRow,
  DraftRoomExportRow,
  DraftRoomRow,
  DraftRoomSaleRow,
  DraftRoomSnapshotRow,
} from "./postgresRows.js";

export interface PlatformPostgresState {
  readonly rooms: Map<string, DraftRoomRow>;
  readonly events: DraftRoomEventRow[];
  readonly roomSnapshots: DraftRoomSnapshotRow[];
  readonly sales: Map<string, DraftRoomSaleRow>;
  readonly exports: Map<string, DraftRoomExportRow>;
  readonly exportContents: Map<string, DraftRoomExportContentRow>;
  readonly advisoryLockKeys: string[];
  failNextDraftRoomRevisionUpdate: boolean;
  exportRowWithContent(id: string): Record<string, unknown> | undefined;
}
