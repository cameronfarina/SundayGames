import type { AccountRecord } from "../../../auth.js";
import { createLeagueSeasonFromConfirmedSetup } from "../../../leagueCreation.js";
import type {
  LeagueConnection,
  LeagueConnectionRepository,
  StoredLeagueSnapshot,
} from "../../../leagueConnections.js";
import { confirmedSetupFromSyncedLeague } from "../../../leagueSyncImport.js";
import type { PlatformApp } from "../../contracts.js";
import { refreshLinkedLeague } from "./refreshLinkedLeague.js";

interface ImportSyncedLeagueInput {
  account: AccountRecord;
  app: PlatformApp;
  connection: LeagueConnection;
  previousSnapshot?: StoredLeagueSnapshot | null;
  repository: LeagueConnectionRepository;
  sessionToken: string;
  snapshot: StoredLeagueSnapshot;
  targetSeasonId?: string;
  now: Date;
}

const needsAttention = async (
  repository: LeagueConnectionRepository,
  connection: LeagueConnection,
  message: string,
  now: Date,
): Promise<LeagueConnection> => {
  await repository.updateConnectionStatus({
    id: connection.id,
    status: "needs_attention",
    statusDetail: message,
    lastSyncedAt: connection.lastSyncedAt,
    now,
  });
  return { ...connection, status: "needs_attention", statusDetail: message };
};

const linkConnection = async (
  repository: LeagueConnectionRepository,
  connection: LeagueConnection,
  accountId: string,
  leagueId: string,
  seasonId: string,
  now: Date,
): Promise<LeagueConnection> => {
  const linked = await repository.linkConnection({
    id: connection.id,
    accountId,
    leagueId,
    seasonId,
    now,
  });
  if (linked === null) throw new Error("The synced league connection disappeared while importing.");
  return linked;
};

export const importSyncedLeague = async ({
  account,
  app,
  connection,
  previousSnapshot = null,
  repository,
  sessionToken,
  snapshot,
  targetSeasonId,
  now,
}: ImportSyncedLeagueInput): Promise<LeagueConnection> => {
  if (connection.linkedLeagueId !== undefined && connection.linkedSeasonId !== undefined) {
    if (targetSeasonId !== undefined && targetSeasonId !== connection.linkedSeasonId) {
      return await needsAttention(
        repository,
        connection,
        "This provider league is already linked to a different Sunday Games league.",
        now,
      );
    }
    const refreshed = await refreshLinkedLeague({
      app,
      connection,
      previousSnapshot,
      sessionToken,
      snapshot,
      now,
    });
    return refreshed.status === "refreshed"
      ? connection
      : await needsAttention(repository, connection, refreshed.message, now);
  }

  if (targetSeasonId !== undefined) {
    const targetUsed = (await repository.listConnections(account.id)).some(candidate =>
      candidate.id !== connection.id && candidate.linkedSeasonId === targetSeasonId);
    if (targetUsed) {
      return await needsAttention(
        repository,
        connection,
        "That Sunday Games league is already linked to another provider league.",
        now,
      );
    }
    const overwritten = await refreshLinkedLeague({
      app,
      connection,
      previousSnapshot: null,
      sessionToken,
      snapshot,
      targetSeasonId,
      now,
    });
    if (overwritten.status === "needs_attention") {
      return await needsAttention(repository, connection, overwritten.message, now);
    }
    return await linkConnection(
      repository,
      connection,
      account.id,
      overwritten.leagueId,
      overwritten.seasonId,
      now,
    );
  }

  const setup = confirmedSetupFromSyncedLeague(connection, snapshot);
  if (setup.status === "needs_attention") {
    return await needsAttention(repository, connection, setup.message, now);
  }

  const season = createLeagueSeasonFromConfirmedSetup(setup.setup);
  const registered = await app.registerLeagueSeason({
    actorSessionToken: sessionToken,
    season,
    memberships: [{ userId: account.id, leagueId: season.leagueId, role: "owner" }],
    now,
  });
  return await linkConnection(
    repository,
    connection,
    account.id,
    registered.leagueId,
    registered.id,
    now,
  );
};
