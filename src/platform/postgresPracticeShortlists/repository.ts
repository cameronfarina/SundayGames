import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import {
  practiceShortlistName,
  type PracticeShortlistItem,
  type PracticeShortlistRepository,
  type SavePracticeShortlistItemInput,
} from "../practiceShortlists.js";
import type { PracticeShortlistRow } from "./contracts.js";
import { itemFromRow } from "./mapping.js";
import { savePracticeShortlistItem } from "./save.js";
import { removeItemSql, selectItemsSql } from "./sql.js";

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
      return await savePracticeShortlistItem(client, input, now);
    });
  }

  async remove(userId: string, seasonId: string, playerName: string): Promise<boolean> {
    const result = await this.#client.query<{ id: string }>(
      removeItemSql,
      [userId, seasonId, playerName.trim(), practiceShortlistName],
    );
    return result.rows.length > 0;
  }
}
