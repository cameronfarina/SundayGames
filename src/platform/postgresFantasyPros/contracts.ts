export interface FantasyProsRankingRow {
  ranking_type: string;
  scoring: string;
  week: number;
  player_id: number;
  player_name: string;
  player_position: string;
  player_team: string | null;
  yahoo_id: string | null;
  rank_ecr: number;
  rank_min: number | null;
  rank_max: number | null;
  rank_average: string | number | null;
  rank_standard_deviation: string | number | null;
  tier: number | null;
  position_rank: string | null;
  bye_week: number | null;
  ecr_delta: string | number | null;
  owned_average: string | number | null;
  owned_espn: string | number | null;
  owned_yahoo: string | number | null;
  fetched_at: Date | string;
}

export interface FantasyProsProjectionRow {
  week: number;
  player_id: number;
  player_name: string;
  player_position: string;
  player_team: string | null;
  points: string | number | null;
  points_ppr: string | number | null;
  passing_yards: string | number | null;
  passing_touchdowns: string | number | null;
  interceptions: string | number | null;
  rushing_yards: string | number | null;
  rushing_touchdowns: string | number | null;
  receptions: string | number | null;
  receiving_yards: string | number | null;
  receiving_touchdowns: string | number | null;
  fetched_at: Date | string;
}

export interface FantasyProsPlayerRow {
  player_id: number;
  player_name: string;
  first_name: string | null;
  last_name: string | null;
  short_name: string | null;
  player_position: string;
  positions_json: unknown;
  player_team: string | null;
  sportsdata_id: string | null;
  fetched_at: Date | string;
}

export interface FantasyProsFetchLogRow {
  dataset: string;
  last_fetched_at: Date | string;
  last_succeeded_at: Date | string | null;
  request_count: string | number;
  row_count: string | number;
  last_error: string | null;
}
