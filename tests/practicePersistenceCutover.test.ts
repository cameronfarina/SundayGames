import { describe, expect, it } from "vitest";
import type { PostgresTransactionalQueryClient } from
  "../src/platform/postgresJobQueue.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";
import { finalizePracticePersistenceCutover } from
  "../src/platform/practicePersistenceCutover.js";

class RecordingCutoverClient implements PostgresTransactionalQueryClient {
  readonly statements: string[] = [];
  controlExists = true;

  async query<TRow = Record<string, unknown>>(
    text: string,
  ): Promise<PostgresQueryResult<TRow>> {
    this.statements.push(text.replace(/\s+/gu, " ").trim());
    if (text.includes("SELECT snapshot_key, revision, snapshot_json")) {
      return {
        rows: [{
          snapshot_key: "default",
          revision: 9,
          snapshot_json: { mockDraftSessions: [] },
        }] as TRow[],
      };
    }
    if (text.includes("UPDATE platform_practice_persistence_control")) {
      return {
        rows: this.controlExists ? [{ mode: "normalized-only" }] as TRow[] : [],
      };
    }
    return { rows: [] };
  }

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    return await operation(this);
  }
}

describe("practice persistence cutover", () => {
  it("irreversibly gates the bridge before scrubbing compatibility sessions", async () => {
    const client = new RecordingCutoverClient();

    await finalizePracticePersistenceCutover(client);

    expect(client.statements).toEqual([
      expect.stringContaining("SELECT pg_advisory_xact_lock"),
      expect.stringContaining("UPDATE platform_practice_persistence_control SET mode = 'normalized-only'"),
      expect.stringContaining("SELECT snapshot_key, revision, snapshot_json"),
      expect.stringMatching(/SET snapshot_json = \$1::jsonb, snapshot_hash = \$2, revision = revision \+ 1/u),
    ]);
  });

  it("refuses to scrub snapshots when the database mode gate is missing", async () => {
    const client = new RecordingCutoverClient();
    client.controlExists = false;

    await expect(finalizePracticePersistenceCutover(client))
      .rejects.toThrow("Practice-persistence cutover control row is missing.");
    expect(client.statements).not.toContainEqual(
      expect.stringContaining("SELECT snapshot_key, revision, snapshot_json"),
    );
  });
});
