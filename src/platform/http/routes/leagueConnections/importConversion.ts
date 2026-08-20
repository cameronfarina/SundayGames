import { leagueImportConversion } from "../../../leagueImportFromSync.js";
import type { LeagueImportConversion } from "../../../leagueImportFromSync.js";
import type { LeagueConnection, StoredLeagueSnapshot } from "../../../leagueConnections.js";
import { syncLeagueConnection, type LeagueSyncServiceOptions } from "../../../leagueSyncService.js";

const conversionFor = (
  connection: LeagueConnection,
  snapshot: StoredLeagueSnapshot,
): LeagueImportConversion => leagueImportConversion({
  provider: connection.provider,
  providerLeagueId: connection.providerLeagueId,
  settings: snapshot.settings,
  teams: snapshot.teams,
});

/** A legacy snapshot gets one provider refresh before asking the owner to intervene. */
export const refreshedLeagueImportConversion = async (
  options: LeagueSyncServiceOptions,
  connection: LeagueConnection,
  snapshot: StoredLeagueSnapshot,
  now: Date,
): Promise<LeagueImportConversion | null> => {
  const conversion = conversionFor(connection, snapshot);
  if (conversion.status !== "blocked") return conversion;
  const synced = await syncLeagueConnection(options, connection, now);
  if (synced.connection === null) return null;
  if (synced.snapshot === undefined) return conversion;
  return conversionFor(synced.connection, synced.snapshot);
};
