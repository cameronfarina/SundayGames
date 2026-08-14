import type { PlatformOnboardingLeague, PlatformOnboardingRow } from "./contracts.js";

export const onboardingLeagueForRow = (
  row: PlatformOnboardingRow,
): PlatformOnboardingLeague => ({
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
    : { roomId: row.room_id, status: row.room_status ?? "setup" },
});
