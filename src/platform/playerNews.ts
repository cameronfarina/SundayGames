import { randomUUID } from "node:crypto";

export const playerNewsRetentionDays = 7;

export interface PlayerNewsStoredItem {
  id: string;
  provider: string;
  providerItemId: string;
  canonicalUrl?: string | undefined;
  playerName?: string | undefined;
  title: string;
  summary: string;
  publishedAt?: string | undefined;
  fetchedAt: string;
  tags: string[];
}

export interface SavePlayerNewsItemInput {
  provider: string;
  providerItemId: string;
  canonicalUrl?: string | undefined;
  playerName?: string | undefined;
  title: string;
  summary: string;
  publishedAt?: string | undefined;
  fetchedAt: string;
  tags: string[];
}

export interface PlayerNewsRepository {
  saveItems(items: readonly SavePlayerNewsItemInput[]): Promise<void>;
  recentItems(now?: Date): Promise<readonly PlayerNewsStoredItem[]>;
  deleteOlderThanRetention(now?: Date): Promise<number>;
}

const retentionCutoffMs = (now: Date): number =>
  now.getTime() - playerNewsRetentionDays * 24 * 60 * 60 * 1000;

const itemDateMs = (item: Pick<PlayerNewsStoredItem, "publishedAt" | "fetchedAt">): number =>
  Date.parse(item.publishedAt ?? item.fetchedAt);

const itemKey = (provider: string, providerItemId: string): string => `${provider}\0${providerItemId}`;

export class InMemoryPlayerNewsRepository implements PlayerNewsRepository {
  readonly #itemsByKey = new Map<string, PlayerNewsStoredItem>();

  async saveItems(items: readonly SavePlayerNewsItemInput[]): Promise<void> {
    for (const item of items) {
      const key = itemKey(item.provider, item.providerItemId);
      const existing = this.#itemsByKey.get(key);
      this.#itemsByKey.set(key, { id: existing?.id ?? randomUUID(), ...item });
    }
  }

  async recentItems(now = new Date()): Promise<readonly PlayerNewsStoredItem[]> {
    const cutoffMs = retentionCutoffMs(now);
    return [...this.#itemsByKey.values()]
      .filter(item => itemDateMs(item) >= cutoffMs)
      .sort((left, right) => itemDateMs(right) - itemDateMs(left));
  }

  async deleteOlderThanRetention(now = new Date()): Promise<number> {
    const cutoffMs = retentionCutoffMs(now);
    let removed = 0;
    for (const [key, item] of this.#itemsByKey) {
      if (itemDateMs(item) < cutoffMs) {
        this.#itemsByKey.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}
