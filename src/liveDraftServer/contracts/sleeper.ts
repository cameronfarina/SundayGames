export interface SleeperSyncPreviewRequest {
  identifier: string;
  season: string;
}

export interface SleeperSyncPreviewLeague {
  leagueId: string;
  name: string;
  status?: string;
  season?: string;
  totalRosters?: number;
}

export interface SleeperSyncPreviewResponse {
  provider: "sleeper";
  readOnly: true;
  identifier: string;
  season: string;
  resolvedAs: "league" | "user";
  message: string;
  leagues: SleeperSyncPreviewLeague[];
  user?: { userId: string; username?: string; displayName?: string };
}

export type SleeperSyncPreviewProvider = (
  request: SleeperSyncPreviewRequest,
) => Promise<SleeperSyncPreviewResponse>;
