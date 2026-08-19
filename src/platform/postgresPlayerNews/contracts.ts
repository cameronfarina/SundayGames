export interface PlayerNewsRow {
  id: string;
  provider: string;
  provider_item_id: string;
  canonical_url: string | null;
  player_name: string | null;
  title: string;
  summary: string;
  published_at: Date | string | null;
  fetched_at: Date | string;
  tags_json: unknown;
  categories_json: unknown;
  analyst_impact: string | null;
  provider_player_id: string | null;
  provider_team_id: string | null;
}
