import type { PostgresTransactionalQueryClient } from "../../../src/platform/postgresJobQueue.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../../../src/platform/postgresPlatformStore.js";
import { FakePostgresClient } from "./fakeSnapshotPostgresClient.js";
import { platformPostgresExportQuery } from "./platformPostgresExportQueries.js";
import { platformPostgresReadQuery } from "./platformPostgresReadQueries.js";
import { platformPostgresRoomQuery } from "./platformPostgresRoomQueries.js";
import type {
  DraftRoomEventRow,
  DraftRoomExportContentRow,
  DraftRoomExportRow,
  DraftRoomRow,
  DraftRoomSaleRow,
  DraftRoomSnapshotRow,
} from "./postgresRows.js";
import {
  cloneContentRow,
  cloneDraftRoomSnapshotRow,
  cloneEventRow,
  cloneExportRow,
  cloneJson,
  cloneRoomRow,
  cloneSaleRow,
  normalizeSql,
} from "./postgresRowUtilities.js";

export class FakeTransactionalPlatformPostgresClient
  extends FakePostgresClient
  implements PostgresTransactionalQueryClient {
  readonly rooms = new Map<string, DraftRoomRow>();
  readonly events: DraftRoomEventRow[] = [];
  readonly roomSnapshots: DraftRoomSnapshotRow[] = [];
  readonly sales = new Map<string, DraftRoomSaleRow>();
  readonly exports = new Map<string, DraftRoomExportRow>();
  readonly exportContents = new Map<string, DraftRoomExportContentRow>();
  readonly advisoryLockKeys: string[] = [];
  transactionsCommitted = 0;
  transactionsRolledBack = 0;
  failNextDraftRoomRevisionUpdate = false;
  rollbackGate?: Promise<void>;
  onRollbackStarted?: (() => void);
  private transactionDepth = 0;

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    if (this.transactionDepth > 0) return await operation(this);
    this.transactionDepth += 1;
    const rowBackup = this.row === undefined
      ? undefined
      : {
        revision: this.row.revision,
        snapshot_json: cloneJson(this.row.snapshot_json),
      };
    const roomsBackup = new Map([...this.rooms].map(([id, row]) => [id, cloneRoomRow(row)]));
    const eventsBackup = this.events.map(cloneEventRow);
    const roomSnapshotsBackup = this.roomSnapshots.map(cloneDraftRoomSnapshotRow);
    const salesBackup = new Map([...this.sales].map(([id, row]) => [id, cloneSaleRow(row)]));
    const exportsBackup = new Map([...this.exports].map(([id, row]) => [id, cloneExportRow(row)]));
    const exportContentsBackup = new Map([...this.exportContents].map(([id, row]) => [id, cloneContentRow(row)]));

    try {
      const result = await operation(this);
      this.transactionsCommitted += 1;
      return result;
    } catch (error) {
      this.transactionsRolledBack += 1;
      this.onRollbackStarted?.();
      await this.rollbackGate;
      this.row = rowBackup;
      this.rooms.clear();
      for (const [id, row] of roomsBackup) this.rooms.set(id, row);
      this.events.splice(0, this.events.length, ...eventsBackup);
      this.roomSnapshots.splice(0, this.roomSnapshots.length, ...roomSnapshotsBackup);
      this.sales.clear();
      for (const [id, row] of salesBackup) this.sales.set(id, row);
      this.exports.clear();
      for (const [id, row] of exportsBackup) this.exports.set(id, row);
      this.exportContents.clear();
      for (const [id, row] of exportContentsBackup) this.exportContents.set(id, row);
      throw error;
    } finally {
      this.transactionDepth -= 1;
    }
  }

  override query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<PostgresQueryResult<TRow>>;
  override async query(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<unknown>> {
    const normalizedSql = normalizeSql(text);
    const result = platformPostgresReadQuery(this, normalizedSql, values)
      ?? platformPostgresRoomQuery(this, normalizedSql, values)
      ?? platformPostgresExportQuery(this, normalizedSql, values);

    return result ?? await super.query(text, values);
  }

  exportRowWithContent(id: string): Record<string, unknown> | undefined {
    const exportRow = this.exports.get(id);
    const content = [...this.exportContents.values()].find(candidate => candidate.artifact_id === id);
    if (exportRow === undefined || content === undefined) return undefined;

    return {
      ...cloneExportRow(exportRow),
      content_base64: content.content_base64,
    };
  }
}
