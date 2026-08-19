import { describe, expect, it } from "vitest";
import { PostgresPlayerNewsRepository } from "../src/platform/postgresPlayerNews.js";
import { playerNewsColumns, upsertItemsSql } from "../src/platform/postgresPlayerNews/sql.js";
import type { PostgresTransactionalQueryClient } from "../src/platform/postgresJobQueue.js";
import type { PostgresQueryClient, PostgresQueryResult } from "../src/platform/postgresPlatformStore.js";

const textOrNull = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

class PlayerNewsClient implements PostgresTransactionalQueryClient {
  readonly rows = new Map<string, Record<string, unknown>>();
  insertStatements = 0;

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    return await operation(this);
  }

  query<TRow = Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<PostgresQueryResult<TRow>>;
  async query(sql: string, values: readonly unknown[] = []): Promise<PostgresQueryResult<unknown>> {
    const normalized = sql.replace(/\s+/gu, " ").trim();
    if (normalized.startsWith("INSERT INTO player_news_items")) {
      this.insertStatements += 1;
      for (let start = 0; start < values.length; start += playerNewsColumns.length) {
        const row = Object.fromEntries(playerNewsColumns.map((column, index) =>
          [column, values[start + index]]));
        const key = `${String(row.provider)}\0${String(row.provider_item_id)}`;
        const existing = [...this.rows.values()]
          .find(candidate => `${String(candidate.provider)}\0${String(candidate.provider_item_id)}` === key);
        const id = existing === undefined ? String(row.id) : String(existing.id);
        this.rows.set(id, { ...row, id });
      }
      return { rows: [] };
    }
    if (normalized.startsWith("SELECT id, provider, provider_item_id")) {
      const cutoff = Date.parse(String(values[0]));
      const sortKey = (row: Record<string, unknown>): number =>
        Date.parse(String(row.published_at ?? row.fetched_at));
      const rows = [...this.rows.values()]
        .filter(row => sortKey(row) >= cutoff)
        .sort((left, right) => sortKey(right) - sortKey(left))
        .map(row => ({
          ...row,
          canonical_url: textOrNull(row.canonical_url),
          player_name: textOrNull(row.player_name),
          published_at: textOrNull(row.published_at),
          analyst_impact: textOrNull(row.analyst_impact),
          provider_player_id: textOrNull(row.provider_player_id),
          provider_team_id: textOrNull(row.provider_team_id),
        }));
      return { rows };
    }
    if (normalized.startsWith("DELETE FROM player_news_items")) {
      const cutoff = Date.parse(String(values[0]));
      const stale = [...this.rows.values()]
        .filter(row => Date.parse(String(row.published_at ?? row.fetched_at)) < cutoff);
      for (const row of stale) this.rows.delete(String(row.id));
      return { rows: [], rowCount: stale.length };
    }
    throw new Error(`Unexpected SQL: ${normalized}`);
  }
}

const rotowireItem = (providerItemId: string, publishedAt: string) => ({
  provider: "rotowire-rss",
  providerItemId,
  title: `Headline ${providerItemId}`,
  summary: "Summary.",
  publishedAt,
  fetchedAt: "2026-08-17T12:00:00.000Z",
  tags: ["News"],
});

describe("Postgres player news repository", () => {
  it("casts every json parameter to jsonb so Postgres does not reject it as text", () => {
    // The fake client below is untyped and would silently accept a bare
    // text parameter; real Postgres does not. A prior version of this
    // query left tags_json uncast and broke every player-news request
    // in production despite this file's other tests passing.
    const sql = upsertItemsSql(1);
    expect(sql).toContain(`$${String(playerNewsColumns.indexOf("tags_json") + 1)}::jsonb`);
    expect(sql).toContain(`$${String(playerNewsColumns.indexOf("categories_json") + 1)}::jsonb`);
  });

  it("writes a whole pull in one statement instead of one per item", async () => {
    // Saving row by row on the request path is what made the news page fall
    // over under concurrent readers.
    const client = new PlayerNewsClient();
    const repository = new PostgresPlayerNewsRepository(client);

    await repository.saveItems(Array.from({ length: 40 }, (_unused, index) =>
      rotowireItem(`item-${String(index)}`, "2026-08-17T06:00:00.000Z")));

    expect(client.insertStatements).toBe(1);
    expect(client.rows.size).toBe(40);
  });

  it("keeps the last copy when one pull repeats an item", async () => {
    // A multi-row upsert cannot touch the same conflict key twice.
    const client = new PlayerNewsClient();
    const repository = new PostgresPlayerNewsRepository(client);

    await repository.saveItems([
      { ...rotowireItem("item-1", "2026-08-17T06:00:00.000Z"), title: "First" },
      { ...rotowireItem("item-1", "2026-08-17T06:00:00.000Z"), title: "Second" },
    ]);

    expect(client.rows.size).toBe(1);
    expect((await repository.recentItems(new Date("2026-08-17T12:00:00.000Z")))[0]?.title)
      .toBe("Second");
  });

  it("upserts on provider and provider item id, then reads it back", async () => {
    const client = new PlayerNewsClient();
    const repository = new PostgresPlayerNewsRepository(client);
    const now = new Date("2026-08-17T12:00:00.000Z");

    await repository.saveItems([{
      provider: "rotowire-rss",
      providerItemId: "item-1",
      canonicalUrl: "https://example.com/item-1",
      playerName: "Example Player",
      title: "Original headline",
      summary: "Original summary.",
      publishedAt: "2026-08-17T06:00:00.000Z",
      fetchedAt: now.toISOString(),
      tags: ["News"],
    }]);
    await repository.saveItems([{
      provider: "rotowire-rss",
      providerItemId: "item-1",
      title: "Updated headline",
      summary: "Updated summary.",
      publishedAt: "2026-08-17T06:00:00.000Z",
      fetchedAt: now.toISOString(),
      tags: ["Injury"],
    }]);

    expect(client.rows.size).toBe(1);
    const items = await repository.recentItems(now);
    expect(items).toEqual([expect.objectContaining({ title: "Updated headline", tags: ["Injury"] })]);
  });

  it("round-trips the fields only FantasyPros supplies", async () => {
    const client = new PlayerNewsClient();
    const repository = new PostgresPlayerNewsRepository(client);
    const now = new Date("2026-08-17T12:00:00.000Z");

    await repository.saveItems([{
      provider: "fantasypros",
      providerItemId: "603053",
      title: "Christian McCaffrey would have practiced",
      summary: "Shanahan said McCaffrey would have practiced.",
      publishedAt: "2026-08-17T06:00:00.000Z",
      fetchedAt: now.toISOString(),
      tags: ["Practice"],
      categories: ["Commentary", "News", "Injury"],
      analystImpact: "McCaffrey remains day-to-day.",
      providerPlayerId: "16393",
      providerTeamAbbreviation: "SF",
    }]);

    expect(await repository.recentItems(now)).toEqual([expect.objectContaining({
      analystImpact: "McCaffrey remains day-to-day.",
      categories: ["Commentary", "News", "Injury"],
      providerPlayerId: "16393",
      providerTeamAbbreviation: "SF",
    })]);
  });

  it("leaves the FantasyPros columns unset for a RotoWire item", async () => {
    const client = new PlayerNewsClient();
    const repository = new PostgresPlayerNewsRepository(client);
    const now = new Date("2026-08-17T12:00:00.000Z");

    await repository.saveItems([rotowireItem("item-1", "2026-08-17T06:00:00.000Z")]);

    const [item] = await repository.recentItems(now);
    expect(item?.categories).toEqual([]);
    expect(item?.analystImpact).toBeUndefined();
    expect(item?.providerPlayerId).toBeUndefined();
  });

  it("excludes items older than the retention window from recentItems", async () => {
    const client = new PlayerNewsClient();
    const repository = new PostgresPlayerNewsRepository(client);
    const now = new Date("2026-08-17T12:00:00.000Z");

    await repository.saveItems([
      { ...rotowireItem("recent", "2026-08-16T12:00:00.000Z"), title: "Recent" },
      { ...rotowireItem("stale", "2026-08-01T12:00:00.000Z"), title: "Stale" },
    ]);

    expect((await repository.recentItems(now)).map(item => item.title)).toEqual(["Recent"]);
  });

  it("deletes rows older than the retention window and reports the count", async () => {
    const client = new PlayerNewsClient();
    const repository = new PostgresPlayerNewsRepository(client);
    const now = new Date("2026-08-17T12:00:00.000Z");

    await repository.saveItems([rotowireItem("stale", "2026-08-01T12:00:00.000Z")]);

    await expect(repository.deleteOlderThanRetention(now)).resolves.toBe(1);
    expect(client.rows.size).toBe(0);
  });
});
