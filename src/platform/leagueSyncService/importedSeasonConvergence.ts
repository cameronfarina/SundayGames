import type { LeagueConnection, LeagueConnectionRepository } from "../leagueConnections.js";
import { LeagueSetupWriteConflictError } from "../leagueSetup.js";
import type { ImportedSeasonRefresher } from "./refreshImportedSeason.js";

export interface ImportedSeasonConvergence {
  connection: LeagueConnection | null;
  detail: string | null;
  stable: boolean;
}

const changedDetail = "This league synced, but its imported season kept changing. Sync again.";
const maximumAttempts = 4;

export const convergeImportedSeason = async (
  repository: LeagueConnectionRepository,
  connection: LeagueConnection,
  refresh: ImportedSeasonRefresher,
): Promise<ImportedSeasonConvergence> => {
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const [currentConnection, currentSnapshot] = await Promise.all([
      repository.findConnection(connection.accountId, connection.id),
      repository.findSnapshot(connection.id),
    ]);
    if (currentConnection === null || currentSnapshot === null ||
        currentConnection.leagueSeasonId === undefined) {
      return { connection: currentConnection, detail: null, stable: true };
    }

    let detail: string | null;
    try {
      detail = await refresh({
        connection: currentConnection,
        snapshot: currentSnapshot,
        syncedAt: currentSnapshot.syncedAt,
        syncRevision: currentSnapshot.syncRevision,
      });
    } catch (error) {
      if (error instanceof LeagueSetupWriteConflictError) continue;
      throw error;
    }
    const [afterConnection, afterSnapshot] = await Promise.all([
      repository.findConnection(connection.accountId, connection.id),
      repository.findSnapshot(connection.id),
    ]);
    if (afterConnection === null) return { connection: null, detail: null, stable: true };
    if (afterConnection.leagueSeasonId === currentConnection.leagueSeasonId &&
        afterSnapshot?.syncRevision === currentSnapshot.syncRevision) {
      return { connection: afterConnection, detail, stable: true };
    }
  }

  const current = await repository.findConnection(connection.accountId, connection.id);
  return { connection: current, detail: changedDetail, stable: false };
};
