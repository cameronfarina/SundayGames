export interface FantasyProsNewsItem {
  itemId: number;
  /** ISO 8601. FantasyPros publishes a zoneless UTC stamp; parsing normalizes it. */
  createdAt: string;
  title: string;
  description: string;
  playerId?: number | undefined;
  teamAbbreviation?: string | undefined;
  author?: string | undefined;
  /** The analyst take FantasyPros ships alongside the report itself. */
  impact?: string | undefined;
  categories: readonly string[];
  link?: string | undefined;
}

export interface FantasyProsNewsRequest {
  limit?: number | undefined;
}
