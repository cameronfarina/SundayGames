import { describe, expect, it } from "vitest";
import { PostgresAuthRepository } from "../src/platform/postgresAuth.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";

interface RecordedQuery {
  text: string;
  values: readonly unknown[];
}

class RecordingPostgresClient implements PostgresQueryClient {
  readonly queries: RecordedQuery[] = [];

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    this.queries.push({ text, values });
    return { rows: [], rowCount: 0 };
  }
}

describe("Postgres password-hash upgrade", () => {
  it("uses an old-hash CAS without invalidating sessions or auth versions", async () => {
    const client = new RecordingPostgresClient();
    const repository = new PostgresAuthRepository(client);
    const upgradedAt = new Date("2026-08-14T12:00:00.000Z");

    await expect(repository.upgradePasswordHash({
      accountId: "acct_legacy",
      expectedPasswordHash: "legacy hash",
      passwordHash: "current hash",
      now: upgradedAt,
    })).resolves.toBeNull();

    expect(client.queries).toHaveLength(1);
    const query = client.queries[0];
    expect(query?.text).toContain("UPDATE accounts");
    expect(query?.text).toContain("SET password_hash = $3, updated_at = $4");
    expect(query?.text).toContain("AND password_hash = $2");
    expect(query?.text).not.toContain("auth_version");
    expect(query?.text).not.toContain("sessions");
    expect(query?.values).toEqual(["acct_legacy", "legacy hash", "current hash", upgradedAt]);
  });
});
