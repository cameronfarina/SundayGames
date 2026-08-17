import type { LeagueSeason } from "../leagueSeason.js";
import type { LeagueCreationRecord, PlatformLeagueMembership } from "../leagueSetup.js";
import type { LiveDraftRoomStatus } from "../liveDraftRooms.js";
import type { WorkspaceRole } from "../workspacePrivacy.js";

export type PlatformReadinessState = "ready" | "needs_attention";

export interface PlatformOnboardingRow {
  league_id: string;
  league_name: string;
  league_slug: string;
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
  leagueSlug: string;
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
  liveDraft: { roomId: string; status: string } | null;
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
