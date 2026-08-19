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
import {
  deleteItemsOlderThanSql,
  playerNewsUpsertBatchSize,
  selectRecentItemsSql,
  upsertItemsSql,
} from "./sql.js";

const retentionCutoff = (now: Date): string =>
  new Date(now.getTime() - playerNewsRetentionDays * 24 * 60 * 60 * 1000).toISOString();

const rowValues = (item: SavePlayerNewsItemInput): readonly unknown[] => [
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
  JSON.stringify(item.categories ?? []),
  item.analystImpact ?? null,
  item.providerPlayerId ?? null,
  item.providerTeamAbbreviation ?? null,
  item.fetchedAt,
];

export class PostgresPlayerNewsRepository implements PlayerNewsRepository {
  readonly #client: PostgresTransactionalQueryClient;

  constructor(client: PostgresTransactionalQueryClient) {
    this.#client = client;
  }

  async saveItems(items: readonly SavePlayerNewsItemInput[]): Promise<void> {
    // A provider can republish the same item inside one pull, and a multi-row
    // upsert cannot hit the same key twice in one statement.
    const byKey = new Map<string, SavePlayerNewsItemInput>();
    for (const item of items) byKey.set(`${item.provider}\0${item.providerItemId}`, item);
    const rows = [...byKey.values()].map(rowValues);

    for (let index = 0; index < rows.length; index += playerNewsUpsertBatchSize) {
      const batch = rows.slice(index, index + playerNewsUpsertBatchSize);
      await this.#client.query(upsertItemsSql(batch.length), batch.flat());
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
