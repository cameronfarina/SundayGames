import type { AccountDashboardLeague, AccountDashboardRow } from "./contracts.js";
import {
  providerFromDb,
  statusFromDb,
  workspaceRoleFromDb,
} from "../postgresLeagueSetup/databaseValues.js";

const countFrom = (value: number | string, field: string): number => {
  const count = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`Account dashboard ${field} is invalid.`);
  }
  return count;
};

export const dashboardLeagueFromRow = (
  row: AccountDashboardRow,
): AccountDashboardLeague => {
  const seasonStatus = statusFromDb(row.season_status);
  return {
    leagueId: row.league_id,
    leagueName: row.league_name,
    leagueSlug: row.league_slug,
    provider: providerFromDb(row.provider),
    seasonId: row.season_id,
    seasonYear: Number(row.season_year),
    seasonStatus,
    membershipRole: workspaceRoleFromDb(row.membership_role),
    ...(row.team_name === null ? {} : { teamDisplayName: row.team_name }),
    draftFormat: row.draft_format === "snake" ? "snake" : "auction",
    teamCount: countFrom(row.team_count, "team count"),
    readiness: {
      leagueSetup: seasonStatus === "draft" ? "needs_attention" : "ready",
      teamClaim: row.team_id === null ? "needs_attention" : "ready",
      liveDraft: row.room_id === null ? "needs_attention" : "ready",
    },
    draft: {
      ...(row.room_id === null ? {} : { roomId: row.room_id }),
      ...(row.room_status === null ? {} : { status: row.room_status }),
      ...(row.draft_starts_at === null ? {} : { startsAt: row.draft_starts_at }),
      ...(row.draft_timezone === null ? {} : { timezone: row.draft_timezone }),
    },
    metrics: {
      historicalImportSeasons: countFrom(
        row.historical_import_seasons, "historical import count",
      ),
      completedMocks: countFrom(row.completed_mocks, "completed mock count"),
      simulationRuns: countFrom(row.simulation_runs, "simulation run count"),
      simulationsCompleted: countFrom(
        row.simulations_completed, "completed simulation count",
      ),
      savedSimulationOutcomes: countFrom(
        row.saved_simulation_outcomes, "saved simulation outcome count",
      ),
    },
  };
};
