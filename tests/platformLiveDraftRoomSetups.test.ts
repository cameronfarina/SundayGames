import { describe, expect, it } from "vitest";
import {
  InMemoryLiveDraftRoomSetupRepository,
  PostgresLiveDraftRoomSetupRepository,
  type LiveDraftRoomSetupPostgresRow,
} from "../src/platform/liveDraftRoomSetups.js";
import type { PostgresQueryClient, PostgresQueryResult } from "../src/platform/postgresPlatformStore.js";

const input = {
  seasonId: "season_2026",
  sourceVersion: "mockd-2026-v1",
  playerCatalog: [{ name: "Puka Nacua", position: "WR" as const, expectedPrice: 73 }],
  initialRosters: [{
    teamId: "team_cam",
    ownerId: "cam",
    playerName: "De'Von Achane",
    position: "RB" as const,
    price: 50,
    source: "keeper" as const,
  }],
  updatedAt: new Date("2026-08-10T12:00:00.000Z"),
};

class SetupClient implements PostgresQueryClient {
  readonly queries: Array<{ sql: string; params: readonly unknown[] }> = [];
  stored: LiveDraftRoomSetupPostgresRow | undefined;

  async query<TRow>(sql: string, params: readonly unknown[] = []): Promise<PostgresQueryResult<TRow>> {
    this.queries.push({ sql, params });
    if (sql.startsWith("INSERT INTO")) {
      this.stored = {
        league_season_id: String(params[0]),
        source_version: String(params[1]),
        player_catalog_json: JSON.parse(String(params[2])),
        initial_rosters_json: JSON.parse(String(params[3])),
        content_hash: String(params[4]),
        updated_at: params[5] as Date,
      };
    }
    return { rows: (this.stored === undefined ? [] : [this.stored]) as TRow[] };
  }
}

describe("live draft room setup repositories", () => {
  it("stores season-owned setup data without sharing mutable references", async () => {
    const repository = new InMemoryLiveDraftRoomSetupRepository();
    const saved = await repository.save(input);
    const loaded = await repository.findForSeason(input.seasonId);

    expect(loaded).toEqual(saved);
    expect(saved.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(loaded?.playerCatalog).not.toBe(input.playerCatalog);
  });

  it("upserts and reads the exact season through Postgres", async () => {
    const client = new SetupClient();
    const repository = new PostgresLiveDraftRoomSetupRepository(client);

    const saved = await repository.save(input);
    const loaded = await repository.findForSeason(input.seasonId);

    expect(saved).toEqual(loaded);
    expect(client.queries[0]?.sql).toContain("ON CONFLICT (league_season_id)");
    expect(client.queries[1]?.params).toEqual([input.seasonId]);
  });
});
