import type { PostgresQueryResult } from "../postgresPlatformStore.js";
import type { PracticeShortlistItem } from "../practiceShortlists.js";
import type { PracticeShortlistRow } from "./contracts.js";

export const firstRow = <TRow>(result: PostgresQueryResult<TRow>): TRow | undefined =>
  result.rows[0];

export const itemFromRow = (row: PracticeShortlistRow): PracticeShortlistItem => ({
  id: row.id,
  leagueId: row.league_id,
  seasonId: row.league_season_id,
  userId: row.user_id,
  playerName: row.player_name,
  position: row.position,
  ...(row.max_bid === null ? {} : { maxBid: row.max_bid }),
  priority: row.priority,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});
