import type {
  LeagueConnection,
  LeagueConnectionRepository,
} from "../leagueConnections.js";
import type { SyncConnectionResult } from "./syncConnection.js";

export const authoritativeSyncResult = async (
  repository: LeagueConnectionRepository,
  requestedConnection: LeagueConnection,
): Promise<SyncConnectionResult> => {
  const [connection, snapshot] = await Promise.all([
    repository.findConnection(requestedConnection.accountId, requestedConnection.id),
    repository.findSnapshot(requestedConnection.id),
  ]);
  if (connection === null) return { connection: null };
  return {
    connection,
    ...(snapshot === null ? {} : { snapshot }),
  };
};
