import type { LeagueConnection } from "../../../leagueConnections.js";
import type { PlatformOnboardingRepository } from "../../../platformOnboarding.js";

/** The Sunday Games league a connection produced, named the way links need it. */
export interface ImportedLeague {
  seasonId: string;
  leagueId: string;
  leagueSlug: string;
  leagueName: string;
}

/**
 * The onboarding list is the one place that already resolves a league's public
 * slug for a given account, and it only lists leagues the account can still
 * open. A link to a league that has since gone away therefore resolves to
 * nothing, which is exactly what the connection should report.
 */
export const importedLeaguesByConnectionId = async (
  repository: PlatformOnboardingRepository | undefined,
  accountId: string,
  connections: readonly LeagueConnection[],
): Promise<ReadonlyMap<string, ImportedLeague>> => {
  const linked = connections.filter(connection => connection.leagueSeasonId !== undefined);
  if (repository === undefined || linked.length === 0) return new Map();

  const leaguesBySeasonId = new Map(
    (await repository.listForUser(accountId)).map(league => [league.seasonId, league]),
  );
  const entries: [string, ImportedLeague][] = [];
  for (const connection of linked) {
    const league = leaguesBySeasonId.get(connection.leagueSeasonId ?? "");
    if (league === undefined) continue;
    entries.push([connection.id, {
      seasonId: league.seasonId,
      leagueId: league.leagueId,
      leagueSlug: league.leagueSlug,
      leagueName: league.leagueName,
    }]);
  }

  return new Map(entries);
};

export const importedLeagueFor = async (
  repository: PlatformOnboardingRepository | undefined,
  accountId: string,
  connection: LeagueConnection,
): Promise<ImportedLeague | undefined> =>
  (await importedLeaguesByConnectionId(repository, accountId, [connection])).get(connection.id);
