import { randomUUID } from "node:crypto";
import type { PostgresTransactionalQueryClient } from "./postgresJobQueue.js";
import type { PostgresQueryClient, PostgresQueryResult } from "./postgresPlatformStore.js";
import {
  practiceShortlistName,
  type PracticeShortlistItem,
  type PracticeShortlistRepository,
  type SavePracticeShortlistItemInput,
} from "./practiceShortlists.js";

interface PracticeShortlistRow {
  id: string;
  league_id: string;
  league_season_id: string;
  user_id: string;
  player_name: string;
  position: string;
  max_bid: number | null;
  priority: number;
  created_at: Date | string;
  updated_at: Date | string;
}

const firstRow = <TRow>(result: PostgresQueryResult<TRow>): TRow | undefined => result.rows[0];
const dateFromDb = (value: Date | string): Date => new Date(value);

const itemFromRow = (row: PracticeShortlistRow): PracticeShortlistItem => ({
  id: row.id,
  leagueId: row.league_id,
  seasonId: row.league_season_id,
  userId: row.user_id,
  playerName: row.player_name,
  position: row.position,
  ...(row.max_bid === null ? {} : { maxBid: row.max_bid }),
  priority: row.priority,
  createdAt: dateFromDb(row.created_at),
  updatedAt: dateFromDb(row.updated_at),
});

const selectItemsSql = `
SELECT
  i.id,
  l.league_id,
  l.league_season_id,
  l.user_id,
  i.player_name,
  i.position,
  i.max_bid,
  i.priority,
  i.created_at,
  i.updated_at
FROM target_list_items i
JOIN target_lists l ON l.id = i.target_list_id
`.trim();

export class PostgresPracticeShortlistRepository implements PracticeShortlistRepository {
  readonly #client: PostgresTransactionalQueryClient;

  constructor(client: PostgresTransactionalQueryClient) {
    this.#client = client;
  }

  async listForUserSeason(userId: string, seasonId: string): Promise<readonly PracticeShortlistItem[]> {
    const result = await this.#client.query<PracticeShortlistRow>(
      `${selectItemsSql}
WHERE l.user_id = $1 AND l.league_season_id = $2 AND l.status = 'active' AND l.name = $3
ORDER BY i.priority ASC, i.player_name ASC`,
      [userId, seasonId, practiceShortlistName],
    );

    return result.rows.map(itemFromRow);
  }

  async save(input: SavePracticeShortlistItemInput): Promise<PracticeShortlistItem> {
    const now = input.now ?? new Date();
    return await this.#client.transaction(async client => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [`practice-shortlist:${input.userId}:${input.seasonId}`],
      );
      return await this.#saveInTransaction(client, input, now);
    });
  }

  async #saveInTransaction(
    client: PostgresQueryClient,
    input: SavePracticeShortlistItemInput,
    now: Date,
  ): Promise<PracticeShortlistItem> {
    const listResult = await client.query<{ id: string }>(
      `
SELECT id
FROM target_lists
WHERE user_id = $1 AND league_season_id = $2 AND status = 'active' AND name = $3
ORDER BY created_at ASC
LIMIT 1
`.trim(),
      [input.userId, input.seasonId, practiceShortlistName],
    );
    let listId = firstRow(listResult)?.id;
    if (listId === undefined) {
      listId = `targets_${randomUUID()}`;
      await client.query(
        `
INSERT INTO target_lists (
  id, league_id, league_season_id, user_id, name, status, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, 'active', $6, $6)
`.trim(),
        [listId, input.leagueId, input.seasonId, input.userId, practiceShortlistName, now],
      );
    }

    const existingResult = await client.query<{ id: string }>(
      `
SELECT id
FROM target_list_items
WHERE target_list_id = $1 AND lower(player_name) = lower($2)
LIMIT 1
`.trim(),
      [listId, input.playerName.trim()],
    );
    const existing = firstRow(existingResult);
    let itemId = existing?.id;
    if (itemId === undefined) {
      const priorityResult = await client.query<{ next_priority: number | string }>(
        "SELECT COALESCE(MAX(priority), 0) + 1 AS next_priority FROM target_list_items WHERE target_list_id = $1",
        [listId],
      );
      const priority = Number(firstRow(priorityResult)?.next_priority ?? 1);
      itemId = `target_${randomUUID()}`;
      await client.query(
        `
INSERT INTO target_list_items (
  id, target_list_id, player_name, position, max_bid, priority, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
`.trim(),
        [
          itemId,
          listId,
          input.playerName.trim(),
          input.position.trim().toUpperCase(),
          input.maxBid ?? null,
          priority,
          now,
        ],
      );
    } else {
      await client.query(
        `
UPDATE target_list_items
SET player_name = $2, position = $3, max_bid = $4, updated_at = $5
WHERE id = $1
`.trim(),
        [
          itemId,
          input.playerName.trim(),
          input.position.trim().toUpperCase(),
          input.maxBid ?? null,
          now,
        ],
      );
    }

    const savedResult = await client.query<PracticeShortlistRow>(
      `${selectItemsSql} WHERE i.id = $1 AND l.user_id = $2`,
      [itemId, input.userId],
    );
    const saved = firstRow(savedResult);
    if (saved === undefined) throw new Error("Saved Practice shortlist item was not found.");

    return itemFromRow(saved);
  }

  async remove(userId: string, seasonId: string, playerName: string): Promise<boolean> {
    const result = await this.#client.query<{ id: string }>(
      `
DELETE FROM target_list_items i
USING target_lists l
WHERE i.target_list_id = l.id
  AND l.user_id = $1
  AND l.league_season_id = $2
  AND l.status = 'active'
  AND lower(i.player_name) = lower($3)
  AND l.name = $4
RETURNING i.id
`.trim(),
      [userId, seasonId, playerName.trim(), practiceShortlistName],
    );

    return result.rows.length > 0;
  }
}
