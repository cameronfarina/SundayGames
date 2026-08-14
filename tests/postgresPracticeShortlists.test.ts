import { describe, expect, it } from "vitest";
import { PostgresPracticeShortlistRepository } from "../src/platform/postgresPracticeShortlists.js";
import type { PostgresTransactionalQueryClient } from "../src/platform/postgresJobQueue.js";
import type { PostgresQueryClient, PostgresQueryResult } from "../src/platform/postgresPlatformStore.js";
import { dateValueAt } from "./support/postgresParameterValues.js";

interface StoredItem {
  id: string;
  listId: string;
  playerName: string;
  position: string;
  maxBid: number | null;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

class PracticeShortlistClient implements PostgresTransactionalQueryClient {
  readonly queries: Array<{ sql: string; values: readonly unknown[] }> = [];
  listId: string | undefined;
  readonly items = new Map<string, StoredItem>();
  transactionCount = 0;

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    return await operation(this);
  }

  query<TRow = Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<PostgresQueryResult<TRow>>;
  async query(
    sql: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<unknown>> {
    this.queries.push({ sql, values });
    const normalized = sql.replace(/\s+/gu, " ").trim();
    if (normalized.startsWith("SELECT pg_advisory_xact_lock")) return { rows: [] };
    if (normalized.startsWith("SELECT id FROM target_lists")) {
      return { rows: this.listId === undefined ? [] : [{ id: this.listId }] };
    }
    if (normalized.startsWith("INSERT INTO target_lists")) {
      this.listId = String(values[0]);
      return { rows: [] };
    }
    if (normalized.startsWith("SELECT id FROM target_list_items")) {
      const playerName = String(values[1]).toLowerCase();
      const item = [...this.items.values()].find(candidate =>
        candidate.listId === values[0] && candidate.playerName.toLowerCase() === playerName
      );
      return { rows: item === undefined ? [] : [{ id: item.id, priority: item.priority }] };
    }
    if (normalized.startsWith("SELECT COALESCE(MAX(priority)")) {
      return { rows: [{ next_priority: this.items.size + 1 }] };
    }
    if (normalized.startsWith("INSERT INTO target_list_items")) {
      const now = dateValueAt(values, 6);
      this.items.set(String(values[0]), {
        id: String(values[0]),
        listId: String(values[1]),
        playerName: String(values[2]),
        position: String(values[3]),
        maxBid: values[4] === null ? null : Number(values[4]),
        priority: Number(values[5]),
        createdAt: now,
        updatedAt: now,
      });
      return { rows: [] };
    }
    if (normalized.startsWith("UPDATE target_list_items")) {
      const item = this.items.get(String(values[0]));
      if (item !== undefined) {
        item.playerName = String(values[1]);
        item.position = String(values[2]);
        item.maxBid = values[3] === null ? null : Number(values[3]);
        item.updatedAt = dateValueAt(values, 4);
      }
      return { rows: [] };
    }
    if (normalized.startsWith("DELETE FROM target_list_items")) {
      const playerName = String(values[2]).toLowerCase();
      const item = [...this.items.values()].find(candidate =>
        candidate.playerName.toLowerCase() === playerName
      );
      if (item === undefined) return { rows: [] };
      this.items.delete(item.id);
      return { rows: [{ id: item.id }] };
    }
    if (normalized.includes("FROM target_list_items i JOIN target_lists l")) {
      const requestedItemId = normalized.includes("WHERE i.id = $1") ? String(values[0]) : undefined;
      const rows = [...this.items.values()]
        .filter(item => requestedItemId === undefined || item.id === requestedItemId)
        .map(item => ({
          id: item.id,
          league_id: "league_1",
          league_season_id: "season_1",
          user_id: "user_1",
          player_name: item.playerName,
          position: item.position,
          max_bid: item.maxBid,
          priority: item.priority,
          created_at: item.createdAt,
          updated_at: item.updatedAt,
        }));
      return { rows };
    }
    throw new Error(`Unexpected SQL: ${normalized}`);
  }
}

describe("Postgres Practice shortlists", () => {
  it("creates one private list, updates an item, lists it, and removes it", async () => {
    const client = new PracticeShortlistClient();
    const repository = new PostgresPracticeShortlistRepository(client);
    const now = new Date("2026-08-12T12:00:00.000Z");

    const created = await repository.save({
      leagueId: "league_1",
      seasonId: "season_1",
      userId: "user_1",
      playerName: "Puka Nacua",
      position: "WR",
      maxBid: 71,
      now,
    });
    expect(created).toMatchObject({ playerName: "Puka Nacua", position: "WR", maxBid: 71, priority: 1 });

    const updated = await repository.save({
      leagueId: "league_1",
      seasonId: "season_1",
      userId: "user_1",
      playerName: "Puka Nacua",
      position: "WR",
      maxBid: 68,
      now: new Date("2026-08-12T13:00:00.000Z"),
    });
    expect(updated).toMatchObject({ id: created.id, maxBid: 68, priority: 1 });
    await expect(repository.listForUserSeason("user_1", "season_1")).resolves.toMatchObject([
      { id: created.id, playerName: "Puka Nacua", maxBid: 68 },
    ]);
    await expect(repository.remove("user_1", "season_1", "puka nacua")).resolves.toBe(true);
    await expect(repository.listForUserSeason("user_1", "season_1")).resolves.toEqual([]);
    expect(client.queries.filter(query => query.sql.includes("INSERT INTO target_lists"))).toHaveLength(1);
    expect(client.transactionCount).toBe(2);
    expect(client.queries.filter(query => query.sql.includes("pg_advisory_xact_lock"))).toHaveLength(2);
    expect(client.queries.find(query => query.sql.includes("ORDER BY i.priority"))).toMatchObject({
      values: ["user_1", "season_1", "Practice shortlist"],
    });
    expect(client.queries.find(query => query.sql.includes("DELETE FROM target_list_items"))).toMatchObject({
      values: ["user_1", "season_1", "puka nacua", "Practice shortlist"],
    });
  });
});
