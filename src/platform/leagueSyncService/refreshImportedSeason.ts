import type { LeagueConnection, LeagueSnapshot } from "../leagueConnections.js";

export type ImportedSeasonRefresher = (input: {
  connection: LeagueConnection;
  snapshot: LeagueSnapshot;
  syncedAt: string;
  syncRevision: string;
}) => Promise<string | null>;

export const refreshImportedSeasonDetail = async (
  refresh: ImportedSeasonRefresher | undefined,
  connection: LeagueConnection,
  snapshot: LeagueSnapshot,
  syncedAt: string,
  syncRevision: string,
): Promise<string | null> => {
  if (refresh === undefined || connection.leagueSeasonId === undefined) return null;
  try {
    return await refresh({ connection, snapshot, syncedAt, syncRevision });
  } catch {
    return "This league synced, but the Sunday Games league it created could not be updated.";
  }
};
