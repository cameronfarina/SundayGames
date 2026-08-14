import type { PostgresQueryClient } from "./postgresPlatformStore.js";
import type { LeagueSeason } from "./leagueSeason.js";
import type { LeagueCreationRecord, PlatformLeagueMembership } from "./leagueSetup.js";
import type { LiveDraftRoomStatus } from "./liveDraftRooms.js";
import type { WorkspaceRole } from "./workspacePrivacy.js";

type PlatformReadinessState = "ready" | "needs_attention";

const readinessState = (ready: boolean): PlatformReadinessState =>
  ready ? "ready" : "needs_attention";

export interface PlatformOnboardingRow {
  league_id: string;
  league_name: string;
  season_id: string;
  season_year: number;
  season_status: string;
  role: WorkspaceRole;
  team_id: string | null;
  team_key: string | null;
  team_name: string | null;
  owner_name: string | null;
  room_id: string | null;
  room_status: string | null;
  draft_scheduled_at: string | null;
}

export interface PlatformOnboardingAccount {
  id: string;
  email: string;
}

export interface PlatformOnboardingLeague {
  leagueId: string;
  leagueName: string;
  seasonId: string;
  seasonYear: number;
  membership: {
    role: WorkspaceRole;
    ownerId?: string;
    teamId?: string;
    ownerDisplayName?: string;
    teamDisplayName?: string;
  };
  canManageLeague: boolean;
  readiness: {
    leagueSetup: PlatformReadinessState;
    teamClaim: PlatformReadinessState;
    liveDraft: PlatformReadinessState;
  };
  nextDraftAt?: string;
  liveDraft: {
    roomId: string;
    status: string;
  } | null;
}

export interface PlatformOnboardingSnapshot {
  account: PlatformOnboardingAccount;
  leagues: readonly PlatformOnboardingLeague[];
}

export interface PlatformOnboardingRepository {
  listForUser(userId: string): Promise<readonly PlatformOnboardingLeague[]>;
}

export interface InMemoryPlatformOnboardingSource {
  leagueSeasons: readonly LeagueSeason[];
  leagueCreationRecords?: readonly LeagueCreationRecord[];
  memberships: readonly PlatformLeagueMembership[];
  liveDraftRooms: readonly {
    roomId: string;
    leagueId: string;
    seasonId: string;
    status: LiveDraftRoomStatus;
    startsAt?: Date | undefined;
    createdAt: Date;
  }[];
}

const platformOnboardingQuery = `
SELECT
  l.id AS league_id,
  l.name AS league_name,
  ls.id AS season_id,
  ls.season_year,
  ls.status AS season_status,
  lm.role,
  ft.id AS team_id,
  ft.team_key,
  ft.team_name,
  ft.owner_name,
  dr.id AS room_id,
  dr.status AS room_status,
  COALESCE(dr.starts_at::text, ls.settings_json ->> 'draftScheduledAt') AS draft_scheduled_at
FROM league_memberships lm
JOIN leagues l ON l.id = lm.league_id
JOIN LATERAL (
  SELECT season.*
  FROM league_seasons season
  WHERE season.league_id = lm.league_id
  ORDER BY season.season_year DESC, season.created_at DESC
  LIMIT 1
) ls ON true
LEFT JOIN fantasy_teams ft
  ON ft.league_season_id = ls.id
  AND ft.owner_user_id = lm.user_id
LEFT JOIN LATERAL (
  SELECT room.*
  FROM draft_rooms room
  WHERE room.league_season_id = ls.id
    AND room.room_type = 'real'
  ORDER BY room.created_at DESC
  LIMIT 1
) dr ON true
WHERE lm.user_id = $1
  AND lm.status = 'active'
  AND l.archived_at IS NULL
ORDER BY l.name, ls.season_year DESC;
`.trim();

const leagueForRow = (row: PlatformOnboardingRow): PlatformOnboardingLeague => ({
  leagueId: row.league_id,
  leagueName: row.league_name,
  seasonId: row.season_id,
  seasonYear: row.season_year,
  membership: {
    role: row.role,
    ...(row.team_key === null ? {} : { ownerId: row.team_key }),
    ...(row.team_id === null ? {} : { teamId: row.team_id }),
    ...(row.owner_name === null ? {} : { ownerDisplayName: row.owner_name }),
    ...(row.team_name === null ? {} : { teamDisplayName: row.team_name }),
  },
  canManageLeague: row.role === "owner" || row.role === "admin",
  readiness: {
    leagueSetup: row.season_status === "published" || row.season_status === "locked"
      ? "ready"
      : "needs_attention",
    teamClaim: row.team_id === null ? "needs_attention" : "ready",
    liveDraft: row.room_id === null ? "needs_attention" : "ready",
  },
  ...(row.draft_scheduled_at === null ? {} : { nextDraftAt: row.draft_scheduled_at }),
  liveDraft: row.room_id === null
    ? null
    : {
        roomId: row.room_id,
        status: row.room_status ?? "setup",
      },
});

export class PostgresPlatformOnboardingRepository implements PlatformOnboardingRepository {
  constructor(private readonly client: PostgresQueryClient) {}

  async listForUser(userId: string): Promise<readonly PlatformOnboardingLeague[]> {
    const result = await this.client.query<PlatformOnboardingRow>(platformOnboardingQuery, [userId]);
    return result.rows.map(leagueForRow);
  }
}

export class InMemoryPlatformOnboardingRepository implements PlatformOnboardingRepository {
  constructor(private readonly source: () => InMemoryPlatformOnboardingSource) {}

  async listForUser(userId: string): Promise<readonly PlatformOnboardingLeague[]> {
    const source = this.source();
    const archivedLeagueIds = new Set(
      (source.leagueCreationRecords ?? [])
        .filter(record => record.archivedAt !== undefined)
        .map(record => record.leagueId),
    );

    return source.memberships
      .filter(membership =>
        membership.userId === userId && !archivedLeagueIds.has(membership.leagueId)
      )
      .flatMap(membership => {
        const season = source.leagueSeasons
          .filter(candidate => candidate.leagueId === membership.leagueId)
          .sort((left, right) => right.seasonYear - left.seasonYear)[0];
        if (season === undefined) return [];

        const team = season.teams.find(candidate => candidate.id === membership.teamId);
        const room = source.liveDraftRooms
          .filter(candidate => candidate.seasonId === season.id)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
        const nextDraftAt = room?.startsAt?.toISOString() ?? season.draft?.scheduledAt;

        return [{
          leagueId: season.leagueId,
          leagueName: season.league.name,
          seasonId: season.id,
          seasonYear: season.seasonYear,
          membership: {
            role: membership.role,
            ...(membership.ownerId === undefined ? {} : { ownerId: membership.ownerId }),
            ...(membership.teamId === undefined ? {} : { teamId: membership.teamId }),
            ...(team === undefined ? {} : {
              ownerDisplayName: team.ownerDisplayName,
              teamDisplayName: team.displayName,
            }),
          },
          canManageLeague: membership.role === "owner" || membership.role === "admin",
          readiness: {
            leagueSetup: readinessState(
              season.setupStatus === "published" || season.setupStatus === "locked",
            ),
            teamClaim: readinessState(team !== undefined),
            liveDraft: readinessState(room !== undefined),
          },
          ...(nextDraftAt === undefined ? {} : { nextDraftAt }),
          liveDraft: room === undefined
            ? null
            : { roomId: room.roomId, status: room.status },
        }];
      })
      .sort((left, right) => left.leagueName.localeCompare(right.leagueName));
  }
}

export const loadPlatformOnboarding = async (
  repository: PlatformOnboardingRepository,
  input: { account: PlatformOnboardingAccount },
): Promise<PlatformOnboardingSnapshot> => ({
  account: input.account,
  leagues: await repository.listForUser(input.account.id),
});
