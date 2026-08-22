import type {
  DraftFormat,
  LeagueProvider,
  LeagueSeasonSetupStatus,
} from "../leagueSeason.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type { WorkspaceRole } from "../workspacePrivacy.js";

type CountValue = number | string;
export type AccountDashboardReadinessState = "ready" | "needs_attention";

export interface AccountDashboardRow {
  league_id: string;
  league_name: string;
  league_slug: string;
  provider: string | null;
  season_id: string;
  season_year: number;
  season_status: string;
  membership_role: string;
  team_id: string | null;
  team_name: string | null;
  draft_format: string | null;
  team_count: CountValue;
  room_id: string | null;
  room_status: string | null;
  draft_starts_at: string | null;
  draft_timezone: string | null;
  historical_import_seasons: CountValue;
  completed_mocks: CountValue;
  simulation_runs: CountValue;
  simulations_completed: CountValue;
  saved_simulation_outcomes: CountValue;
}

export interface AccountDashboardLeague {
  leagueId: string;
  leagueName: string;
  leagueSlug: string;
  provider: LeagueProvider;
  seasonId: string;
  seasonYear: number;
  seasonStatus: LeagueSeasonSetupStatus;
  membershipRole: WorkspaceRole;
  teamDisplayName?: string;
  draftFormat: DraftFormat;
  teamCount: number;
  readiness: Record<"leagueSetup" | "teamClaim" | "liveDraft", AccountDashboardReadinessState>;
  draft: { roomId?: string; status?: string; startsAt?: string; timezone?: string };
  metrics: {
    historicalImportSeasons: number;
    completedMocks: number;
    simulationRuns: number;
    simulationsCompleted: number;
    savedSimulationOutcomes: number;
  };
}

export interface AccountDashboardRepository {
  listForAccount(accountId: string): Promise<readonly AccountDashboardLeague[]>;
}

export interface AccountDashboardSnapshot {
  leagues: readonly AccountDashboardLeague[];
}

export type AccountDashboardQueryClient = Pick<PostgresQueryClient, "query">;
