import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../../../src/platform/postgresPlatformStore.js";
import type { InsertGate, StoredSnapshotRow } from "./postgresRows.js";

export class FakePostgresClient implements PostgresQueryClient {
  row: StoredSnapshotRow | undefined;
  nextInsertGate: InsertGate | undefined;

  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<PostgresQueryResult<TRow>>;
  async query(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<unknown>> {
    if (text.startsWith("CREATE TABLE") || text.startsWith("CREATE INDEX")) {
      return { rows: [] };
    }

    if (text === "SELECT pg_notify($1, $2)") return { rows: [] };

    if (text.startsWith("SELECT revision, snapshot_json")) {
      return { rows: this.row === undefined ? [] : [this.row] };
    }

    if (text.includes("FROM account_onboarding_profiles")) {
      return { rows: [] };
    }

    if (text.startsWith("INSERT INTO platform_store_snapshots")) {
      if (this.nextInsertGate !== undefined) {
        const gate = this.nextInsertGate;
        this.nextInsertGate = undefined;
        gate.entered();
        await gate.release;
      }

      const [, nextRevisionValue, , snapshotJson, , expectedRevisionValue] = values;
      const nextRevision = Number(nextRevisionValue);
      const expectedRevision = Number(expectedRevisionValue);

      if (this.row === undefined) {
        if (expectedRevision !== 0) return { rows: [], rowCount: 0 };

        this.row = { revision: nextRevision, snapshot_json: snapshotJson };
        return { rows: [{ revision: nextRevision }], rowCount: 1 };
      }

      if (this.row.revision !== expectedRevision) return { rows: [], rowCount: 0 };

      this.row = { revision: nextRevision, snapshot_json: snapshotJson };
      return { rows: [{ revision: nextRevision }], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL: ${text}`);
  }
}
