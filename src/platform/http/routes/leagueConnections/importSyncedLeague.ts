import type { AccountRecord } from "../../../auth.js";
import { createLeagueSeasonFromConfirmedSetup } from "../../../leagueCreation.js";
import type {
  LeagueConnection,
  LeagueConnectionRepository,
  StoredLeagueSnapshot,
} from "../../../leagueConnections.js";
import { confirmedSetupFromSyncedLeague } from "../../../leagueSyncImport.js";
import type { PlatformApp } from "../../contracts.js";

interface ImportSyncedLeagueInput {
  account: AccountRecord;
  app: PlatformApp;
  connection: LeagueConnection;
  repository: LeagueConnectionRepository;
  sessionToken: string;
  snapshot: StoredLeagueSnapshot;
  now: Date;
}

export const importSyncedLeague = async ({
  account,
  app,
  connection,
  repository,
  sessionToken,
  snapshot,
  now,
}: ImportSyncedLeagueInput): Promise<LeagueConnection> => {
  if (connection.linkedLeagueId !== undefined && connection.linkedSeasonId !== undefined) {
    return connection;
  }

  const setup = confirmedSetupFromSyncedLeague(connection, snapshot);
  if (setup.status === "needs_attention") {
    await repository.updateConnectionStatus({
      id: connection.id,
      status: "needs_attention",
      statusDetail: setup.message,
      lastSyncedAt: connection.lastSyncedAt,
      now,
    });
    return { ...connection, status: "needs_attention", statusDetail: setup.message };
  }

  const season = createLeagueSeasonFromConfirmedSetup(setup.setup);
  const registered = await app.registerLeagueSeason({
    actorSessionToken: sessionToken,
    season,
    memberships: [{ userId: account.id, leagueId: season.leagueId, role: "owner" }],
    now,
  });
  const linked = await repository.linkConnection({
    id: connection.id,
    accountId: account.id,
    leagueId: registered.leagueId,
    seasonId: registered.id,
    now,
  });
  if (linked === null) throw new Error("The synced league connection disappeared while importing.");
  return linked;
};
