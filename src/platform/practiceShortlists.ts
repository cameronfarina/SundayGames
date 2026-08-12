import { randomUUID } from "node:crypto";

export const practiceShortlistName = "Practice shortlist";

export interface PracticeShortlistItem {
  id: string;
  leagueId: string;
  seasonId: string;
  userId: string;
  playerName: string;
  position: string;
  maxBid?: number | undefined;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavePracticeShortlistItemInput {
  leagueId: string;
  seasonId: string;
  userId: string;
  playerName: string;
  position: string;
  maxBid?: number | undefined;
  now?: Date | undefined;
}

export interface PracticeShortlistRepository {
  listForUserSeason(userId: string, seasonId: string): Promise<readonly PracticeShortlistItem[]>;
  save(input: SavePracticeShortlistItemInput): Promise<PracticeShortlistItem>;
  remove(userId: string, seasonId: string, playerName: string): Promise<boolean>;
}

const clone = <T>(value: T): T => structuredClone(value);
const itemKey = (userId: string, seasonId: string, playerName: string): string =>
  [userId, seasonId, playerName.trim().toLowerCase()].join("\0");

export class InMemoryPracticeShortlistRepository implements PracticeShortlistRepository {
  readonly #itemsByKey = new Map<string, PracticeShortlistItem>();

  constructor(items: readonly PracticeShortlistItem[] = []) {
    this.replaceItems(items);
  }

  async listForUserSeason(userId: string, seasonId: string): Promise<readonly PracticeShortlistItem[]> {
    return [...this.#itemsByKey.values()]
      .filter(item => item.userId === userId && item.seasonId === seasonId)
      .sort((left, right) => left.priority - right.priority || left.playerName.localeCompare(right.playerName))
      .map(clone);
  }

  async save(input: SavePracticeShortlistItemInput): Promise<PracticeShortlistItem> {
    const key = itemKey(input.userId, input.seasonId, input.playerName);
    const existing = this.#itemsByKey.get(key);
    const now = input.now ?? new Date();
    const priority = existing?.priority ??
      1 + Math.max(0, ...[...this.#itemsByKey.values()]
        .filter(item => item.userId === input.userId && item.seasonId === input.seasonId)
        .map(item => item.priority));
    const item: PracticeShortlistItem = {
      id: existing?.id ?? `target_${randomUUID()}`,
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      userId: input.userId,
      playerName: input.playerName.trim(),
      position: input.position.trim().toUpperCase(),
      ...(input.maxBid === undefined ? {} : { maxBid: input.maxBid }),
      priority,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.#itemsByKey.set(key, item);

    return clone(item);
  }

  async remove(userId: string, seasonId: string, playerName: string): Promise<boolean> {
    return this.#itemsByKey.delete(itemKey(userId, seasonId, playerName));
  }

  items(): readonly PracticeShortlistItem[] {
    return [...this.#itemsByKey.values()].map(clone);
  }

  replaceItems(items: readonly PracticeShortlistItem[]): void {
    this.#itemsByKey.clear();
    for (const item of items) {
      this.#itemsByKey.set(itemKey(item.userId, item.seasonId, item.playerName), clone(item));
    }
  }
}
