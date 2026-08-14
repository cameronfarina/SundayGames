import { describe, expect, it } from "vitest";
import {
  InMemoryLiveDraftRoomSetupRepository,
  LiveDraftRoomSetupWriteConflictError,
  PostgresLiveDraftRoomSetupRepository,
  type LiveDraftRoomSetupPostgresRow,
  type SaveLiveDraftRoomSetupInput,
} from "../src/platform/liveDraftRoomSetups.js";
import type { PostgresQueryClient, PostgresQueryResult } from "../src/platform/postgresPlatformStore.js";
import { dateValueAt } from "./support/postgresParameterValues.js";

const input: SaveLiveDraftRoomSetupInput = {
  seasonId: "season_2026",
  sourceVersion: "mockd-2026-v1",
  playerCatalog: [{ name: "Puka Nacua", position: "WR", expectedPrice: 73 }],
  initialRosters: [{
    teamId: "team_cam",
    ownerId: "owner11",
    playerName: "De'Von Achane",
    position: "RB",
    price: 50,
    source: "keeper",
  }],
  updatedAt: new Date("2026-08-10T12:00:00.000Z"),
};

class SetupClient implements PostgresQueryClient {
  readonly queries: Array<{ sql: string; params: readonly unknown[] }> = [];
  stored: LiveDraftRoomSetupPostgresRow | undefined;

  query<TRow = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<PostgresQueryResult<TRow>>;
  async query(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<unknown>> {
    this.queries.push({ sql, params });
    if (sql.startsWith("INSERT INTO")) {
      if (sql.includes("DO NOTHING") && this.stored !== undefined) return { rows: [] };
      this.stored = {
        league_season_id: String(params[0]),
        source_version: String(params[1]),
        player_catalog_json: JSON.parse(String(params[2])),
        initial_rosters_json: JSON.parse(String(params[3])),
        content_hash: String(params[4]),
        updated_at: dateValueAt(params, 5),
      };
    } else if (sql.startsWith("UPDATE ")) {
      if (this.stored?.content_hash !== params[6]) return { rows: [] };
      this.stored = {
        league_season_id: String(params[0]),
        source_version: String(params[1]),
        player_catalog_json: JSON.parse(String(params[2])),
        initial_rosters_json: JSON.parse(String(params[3])),
        content_hash: String(params[4]),
        updated_at: dateValueAt(params, 5),
      };
    }
    return { rows: this.stored === undefined ? [] : [this.stored] };
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

  it("rejects malformed stored player data instead of trusting database JSON", async () => {
    const client = new SetupClient();
    const repository = new PostgresLiveDraftRoomSetupRepository(client);
    await repository.save(input);
    if (client.stored === undefined) throw new Error("Expected a stored setup fixture.");
    client.stored.player_catalog_json = [{
      name: "Puka Nacua",
      position: "not-a-position",
      expectedPrice: 73,
    }];

    await expect(repository.findForSeason(input.seasonId)).rejects.toThrow(
      "Stored live draft setup field playerCatalog[0].position is invalid.",
    );
  });

  it("rejects stale in-memory setup updates", async () => {
    const repository = new InMemoryLiveDraftRoomSetupRepository();
    const saved = await repository.save(input, { expectedContentHash: null });

    await expect(repository.save({ ...input, sourceVersion: "new" }, {
      expectedContentHash: "stale-hash",
    })).rejects.toBeInstanceOf(LiveDraftRoomSetupWriteConflictError);
    await expect(repository.findForSeason(input.seasonId)).resolves.toEqual(saved);
  });

  it("uses compare-and-swap updates in Postgres", async () => {
    const client = new SetupClient();
    const repository = new PostgresLiveDraftRoomSetupRepository(client);
    const saved = await repository.save(input, { expectedContentHash: null });

    await expect(repository.save({ ...input, sourceVersion: "stale" }, {
      expectedContentHash: "stale-hash",
    })).rejects.toBeInstanceOf(LiveDraftRoomSetupWriteConflictError);
    const updated = await repository.save({ ...input, sourceVersion: "current" }, {
      expectedContentHash: saved.contentHash,
    });

    expect(updated.sourceVersion).toBe("current");
    expect(client.queries.at(-1)?.sql).toContain("WHERE league_season_id = $1 AND content_hash = $7");
  });
});
