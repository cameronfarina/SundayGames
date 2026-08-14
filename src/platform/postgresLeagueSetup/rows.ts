export interface LeagueSeasonRow {
  id: string;
  league_id: string;
  season_year: number;
  name: string;
  status: string;
  settings_json: unknown;
  league_name: string;
  provider: string | null;
  provider_league_id: string | null;
  draft_format: string | null;
  budget: number | null;
  minimum_bid: number | null;
  snake_json: unknown;
  slots_json: unknown;
  position_maximums_json: unknown;
  scoring_json: unknown;
}

export interface FantasyTeamRow {
  id: string;
  league_season_id: string;
  team_key: string;
  team_name: string;
  owner_name: string;
  abbreviation: string | null;
  manager_names_json: unknown;
  display_order: number;
}

export interface MembershipRow {
  id: string;
  league_id: string;
  user_id: string;
  role: string;
}

export interface TeamClaimRow {
  owner_user_id: string;
  owner_id: string;
  team_id: string;
}

export interface MaxDisplayOrderRow {
  max_display_order: number | null;
}

export interface LeagueCreationCountRow {
  active_league_count: number;
  recent_league_count: number;
  oldest_recent_created_at: Date | null;
}
