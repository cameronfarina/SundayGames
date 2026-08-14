export interface PracticeShortlistRow {
  id: string;
  league_id: string;
  league_season_id: string;
  user_id: string;
  player_name: string;
  position: string;
  max_bid: number | null;
  priority: number;
  created_at: Date | string;
  updated_at: Date | string;
}
