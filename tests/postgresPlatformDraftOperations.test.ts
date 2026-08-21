import { describe, expect, it } from "vitest";
import {
  PostgresPlatformDraftOperationsRepository,
  type PlatformDraftOperationsRow,
} from "../src/platform/platformDraftOperations.js";
import type { PostgresQueryResult } from "../src/platform/postgresPlatformStore.js";

class DraftOperationsClient {
  readonly queries: Array<{ sql: string; values: readonly unknown[] }> = [];

  constructor(readonly rows: readonly PlatformDraftOperationsRow[]) {}

  async query<TRow = Record<string, unknown>>(
    sql: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    this.queries.push({ sql, values });
    return { rows: [...this.rows] as TRow[], rowCount: this.rows.length };
  }
}

describe("PostgresPlatformDraftOperationsRepository", () => {
  it("lists scheduled seasons once and gives room scheduling precedence", async () => {
    const client = new DraftOperationsClient([{
      draft_format: "auction",
      ended_at: null,
      league_id: "league-1",
      league_name: "Sunday Games",
      room_id: "room-1",
      room_status: "setup",
      season_id: "season-1",
      season_name: "2026 season",
      season_year: 2026,
      started_at: null,
      starts_at: "2026-08-23T00:00:00.000Z",
      team_count: 12,
    }]);
    const repository = new PostgresPlatformDraftOperationsRepository(client);
    const from = new Date("2026-08-22T04:00:00.000Z");
    const to = new Date("2026-09-22T04:00:00.000Z");

    await expect(repository.listScheduledDrafts({ from, to })).resolves.toEqual([
      expect.objectContaining({
        roomId: "room-1",
        startsAt: new Date("2026-08-23T00:00:00.000Z"),
        teamCount: 12,
      }),
    ]);

    const query = client.queries[0];
    if (query === undefined) throw new Error("Expected a schedule query.");
    const { sql, values } = query;
    expect(sql).toContain("room.room_type = 'real'");
    expect(sql).toMatch(/COALESCE\(room\.starts_at,\s*room\.started_at,/u);
    expect(sql).toContain("settings_json");
    expect(sql).toContain("LEFT JOIN LATERAL");
    expect(values).toEqual([from, to]);
  });

  it("rejects a null schedule instead of decoding it as the Unix epoch", async () => {
    const client = new DraftOperationsClient([{
      draft_format: "auction",
      ended_at: null,
      league_id: "league-1",
      league_name: "Sunday Games",
      room_id: "room-1",
      room_status: "live",
      season_id: "season-1",
      season_name: "2026 season",
      season_year: 2026,
      started_at: null,
      starts_at: null,
      team_count: 12,
    }]);

    await expect(new PostgresPlatformDraftOperationsRepository(client).listScheduledDrafts({
      from: new Date("2026-08-22T00:00:00.000Z"),
      to: new Date("2026-08-24T00:00:00.000Z"),
    })).rejects.toThrow("Invalid platform draft schedule date");
  });

  it("rejects an invalid draft format returned by Postgres", async () => {
    const client = new DraftOperationsClient([{
      draft_format: "linear",
      ended_at: null,
      league_id: "league-1",
      league_name: "Sunday Games",
      room_id: null,
      room_status: null,
      season_id: "season-1",
      season_name: "2026 season",
      season_year: 2026,
      started_at: null,
      starts_at: "2026-08-23T00:00:00.000Z",
      team_count: 12,
    }]);

    await expect(new PostgresPlatformDraftOperationsRepository(client).listScheduledDrafts({
      from: new Date("2026-08-22T00:00:00.000Z"),
      to: new Date("2026-08-24T00:00:00.000Z"),
    })).rejects.toThrow("Invalid platform draft format");
  });
});
