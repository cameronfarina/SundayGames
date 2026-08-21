import type { DraftFormat } from "../leagueSeason.js";
import type { LiveDraftRoomStatus } from "../liveDraftRooms.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type {
  PlatformDraftOperationsRecord,
  PlatformDraftOperationsRepository,
} from "./contracts.js";

export interface PlatformDraftOperationsRow {
  room_id: string | null;
  room_status: string | null;
  league_id: string;
  league_name: string;
  season_id: string;
  season_name: string;
  season_year: number;
  draft_format: string;
  team_count: number;
  starts_at: string | Date | null;
  started_at: string | Date | null;
  ended_at: string | Date | null;
}

const isDraftFormat = (value: string): value is DraftFormat =>
  value === "auction" || value === "snake";

const isRoomStatus = (value: string): value is LiveDraftRoomStatus =>
  value === "setup" || value === "countdown" || value === "live"
    || value === "paused" || value === "ended";

const requiredDate = (value: string | Date | null): Date => {
  if (value === null) throw new Error("Invalid platform draft schedule date.");
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid platform draft schedule date.");
  return date;
};

const optionalDate = (value: string | Date | null): Date | null =>
  value === null ? null : requiredDate(value);

const recordFor = (row: PlatformDraftOperationsRow): PlatformDraftOperationsRecord => {
  if (!isDraftFormat(row.draft_format)) {
    throw new Error(`Invalid platform draft format: ${row.draft_format}.`);
  }
  if (row.room_status !== null && !isRoomStatus(row.room_status)) {
    throw new Error(`Invalid platform draft room status: ${row.room_status}.`);
  }
  return {
    roomId: row.room_id,
    roomStatus: row.room_status,
    leagueId: row.league_id,
    leagueName: row.league_name,
    seasonId: row.season_id,
    seasonName: row.season_name,
    seasonYear: Number(row.season_year),
    draftFormat: row.draft_format,
    teamCount: Number(row.team_count),
    startsAt: requiredDate(row.starts_at),
    startedAt: optionalDate(row.started_at),
    endedAt: optionalDate(row.ended_at),
  };
};

export class PostgresPlatformDraftOperationsRepository
implements PlatformDraftOperationsRepository {
  constructor(private readonly client: PostgresQueryClient) {}

  async listScheduledDrafts(input: { from: Date; to: Date }) {
    const result = await this.client.query<PlatformDraftOperationsRow>(`
WITH scheduled_seasons AS (
  SELECT l.id AS league_id, l.name AS league_name,
    ls.id AS season_id, ls.name AS season_name, ls.season_year,
    rules.draft_format, COUNT(team.id)::integer AS team_count,
    room.id AS room_id, room.status AS room_status,
    COALESCE(room.starts_at,
      room.started_at,
      NULLIF(ls.settings_json -> 'draft' ->> 'scheduledAt', '')::timestamptz,
      NULLIF(ls.settings_json ->> 'draftScheduledAt', '')::timestamptz) AS starts_at,
    room.started_at, room.ended_at
  FROM leagues l
  JOIN league_seasons ls ON ls.league_id = l.id
  JOIN roster_rule_sets rules ON rules.league_season_id = ls.id
  LEFT JOIN fantasy_teams team ON team.league_season_id = ls.id
  LEFT JOIN LATERAL (
    SELECT room.* FROM draft_rooms room
    WHERE room.league_season_id = ls.id AND room.room_type = 'real'
    ORDER BY room.created_at DESC LIMIT 1
  ) room ON true
  WHERE l.archived_at IS NULL
  GROUP BY l.id, l.name, ls.id, ls.name, ls.season_year, rules.draft_format,
    room.id, room.status, room.starts_at, room.started_at, room.ended_at
)
SELECT * FROM scheduled_seasons
WHERE (starts_at >= $1 AND starts_at < $2) OR room_status IN ('live', 'paused')
ORDER BY starts_at, league_name, season_year DESC
`.trim(), [input.from, input.to]);
    return result.rows.map(recordFor);
  }
}
