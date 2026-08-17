import { describe, expect, it } from "vitest";
import { PostgresPlayerNewsRepository } from "../src/platform/postgresPlayerNews.js";
import { upsertItemSql } from "../src/platform/postgresPlayerNews/sql.js";
import type { PostgresTransactionalQueryClient } from "../src/platform/postgresJobQueue.js";
import type { PostgresQueryClient, PostgresQueryResult } from "../src/platform/postgresPlatformStore.js";

interface StoredRow {
  id: string;
  provider: string;
  provider_item_id: string;
  canonical_url: string | null;
  player_name: string | null;
  title: string;
  summary: string;
  published_at: string | null;
  fetched_at: string;
  tags_json: unknown;
}

class PlayerNewsClient implements PostgresTransactionalQueryClient {
  readonly rows = new Map<string, StoredRow>();

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
      const [id, provider, providerItemId] = values;
      const key = `${String(provider)}\0${String(providerItemId)}`;
      const existing = [...this.rows.values()].find(row => `${row.provider}\0${row.provider_item_id}` === key);
      this.rows.set(existing?.id ?? String(id), {
        id: existing?.id ?? String(id),
        provider: String(provider),
        provider_item_id: String(providerItemId),
        canonical_url: values[3] === null ? null : String(values[3]),
        player_name: values[4] === null ? null : String(values[4]),
        title: String(values[5]),
        summary: String(values[6]),
        published_at: values[7] === null ? null : String(values[7]),
        fetched_at: String(values[8]),
        tags_json: values[9],
      });
      return { rows: [] };
    }
    if (normalized.startsWith("SELECT id, provider, provider_item_id")) {
      const cutoff = Date.parse(String(values[0]));
      const rows = [...this.rows.values()]
        .filter(row => Date.parse(row.published_at ?? row.fetched_at) >= cutoff)
        .sort((left, right) =>
          Date.parse(right.published_at ?? right.fetched_at) - Date.parse(left.published_at ?? left.fetched_at));
      return { rows };
    }
    if (normalized.startsWith("DELETE FROM player_news_items")) {
      const cutoff = Date.parse(String(values[0]));
      const toDelete = [...this.rows.values()].filter(row => Date.parse(row.published_at ?? row.fetched_at) < cutoff);
      for (const row of toDelete) this.rows.delete(row.id);
      return { rows: [], rowCount: toDelete.length };
    }
    throw new Error(`Unexpected SQL: ${normalized}`);
  }
}

describe("Postgres player news repository", () => {
  it("casts the tags parameter to jsonb so Postgres does not reject it as text", () => {
    // The fake client below is untyped and would silently accept a bare
    // text parameter; real Postgres does not. A prior version of this
    // query left tags_json uncast and broke every player-news request
    // in production despite this file's other tests passing.
    expect(upsertItemSql).toContain("$10::jsonb");
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

  it("excludes items older than the retention window from recentItems", async () => {
    const client = new PlayerNewsClient();
    const repository = new PostgresPlayerNewsRepository(client);
    const now = new Date("2026-08-17T12:00:00.000Z");

    await repository.saveItems([
      {
        provider: "espn", providerItemId: "recent", title: "Recent", summary: "s",
        publishedAt: "2026-08-16T12:00:00.000Z", fetchedAt: now.toISOString(), tags: ["News"],
      },
      {
        provider: "espn", providerItemId: "stale", title: "Stale", summary: "s",
        publishedAt: "2026-08-01T12:00:00.000Z", fetchedAt: now.toISOString(), tags: ["News"],
      },
    ]);

    expect((await repository.recentItems(now)).map(item => item.title)).toEqual(["Recent"]);
  });

  it("deletes rows older than the retention window and reports the count", async () => {
    const client = new PlayerNewsClient();
    const repository = new PostgresPlayerNewsRepository(client);
    const now = new Date("2026-08-17T12:00:00.000Z");

    await repository.saveItems([{
      provider: "espn", providerItemId: "stale", title: "Stale", summary: "s",
      publishedAt: "2026-08-01T12:00:00.000Z", fetchedAt: now.toISOString(), tags: ["News"],
    }]);

    await expect(repository.deleteOlderThanRetention(now)).resolves.toBe(1);
    expect(client.rows.size).toBe(0);
  });
});
