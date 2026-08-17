import { randomUUID } from "node:crypto";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import {
  playerNewsRetentionDays,
  type PlayerNewsRepository,
  type PlayerNewsStoredItem,
  type SavePlayerNewsItemInput,
} from "../playerNews.js";
import type { PlayerNewsRow } from "./contracts.js";
import { itemFromRow } from "./mapping.js";
import { deleteItemsOlderThanSql, selectRecentItemsSql, upsertItemSql } from "./sql.js";

const retentionCutoff = (now: Date): string =>
  new Date(now.getTime() - playerNewsRetentionDays * 24 * 60 * 60 * 1000).toISOString();

export class PostgresPlayerNewsRepository implements PlayerNewsRepository {
  readonly #client: PostgresTransactionalQueryClient;

  constructor(client: PostgresTransactionalQueryClient) {
    this.#client = client;
  }

  async saveItems(items: readonly SavePlayerNewsItemInput[]): Promise<void> {
    for (const item of items) {
      await this.#client.query(upsertItemSql, [
        randomUUID(),
        item.provider,
        item.providerItemId,
        item.canonicalUrl ?? null,
        item.playerName ?? null,
        item.title,
        item.summary,
        item.publishedAt ?? null,
        item.fetchedAt,
        JSON.stringify(item.tags),
      ]);
    }
  }

  async recentItems(now = new Date()): Promise<readonly PlayerNewsStoredItem[]> {
    const result = await this.#client.query<PlayerNewsRow>(selectRecentItemsSql, [retentionCutoff(now)]);
    return result.rows.map(itemFromRow);
  }

  async deleteOlderThanRetention(now = new Date()): Promise<number> {
    const result = await this.#client.query(deleteItemsOlderThanSql, [retentionCutoff(now)]);
    return result.rowCount ?? 0;
  }
}
