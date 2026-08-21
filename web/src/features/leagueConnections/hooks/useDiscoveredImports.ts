import { useState } from "react";
import type { ConnectionCredentials } from "../api/leagueConnectionsApi";
import type {
  DiscoveredLeague,
  LeagueConnection,
  LeagueConnectionProvider,
} from "../api/leagueConnectionsSchema";
import {
  discoveredLeagueKey,
  importStateFromConnections,
  isImportRunning,
  type LeagueImportState,
  type LeagueImportStates,
} from "../lib/discoveredLeagueState";
import { importFailure } from "../lib/importFailure";
import type { useLeagueConnectionMutations } from "./useLeagueConnectionMutations";

interface UseDiscoveredImportsOptions {
  readonly connections: readonly LeagueConnection[];
  readonly credentials: ConnectionCredentials;
  readonly leagues: readonly DiscoveredLeague[];
  readonly mutations: ReturnType<typeof useLeagueConnectionMutations>;
  readonly onImported: () => void;
  readonly provider: LeagueConnectionProvider | undefined;
}

export interface UseDiscoveredImportsResult {
  readonly importAll: () => void;
  readonly importLeague: (league: DiscoveredLeague) => void;
  readonly reset: () => void;
  readonly running: boolean;
  readonly states: LeagueImportStates;
}

const alreadyHandled = (state: LeagueImportState): boolean =>
  isImportRunning(state) || state.status === "imported";

/**
 * Importing a discovered league is two calls in a row: save the connection, then
 * turn its snapshot into a real Sunday Games league. They are run one league at a
 * time so a whole account's worth of leagues cannot bury the provider in
 * requests, and so every league ends with a status of its own.
 */
export const useDiscoveredImports = ({
  connections,
  credentials,
  leagues,
  mutations,
  onImported,
  provider,
}: UseDiscoveredImportsOptions): UseDiscoveredImportsResult => {
  const [reported, setReported] = useState<LeagueImportStates>({});

  const stateFor = (league: DiscoveredLeague): LeagueImportState =>
    reported[discoveredLeagueKey(league)] ?? importStateFromConnections(connections, league);

  const report = (league: DiscoveredLeague, state: LeagueImportState): void => {
    setReported(previous => ({ ...previous, [discoveredLeagueKey(league)]: state }));
  };

  const runImport = async (league: DiscoveredLeague): Promise<boolean> => {
    if (provider === undefined) return false;
    report(league, { status: "connecting" });
    try {
      const connected = await mutations.connect.mutateAsync({
        provider,
        providerLeagueId: league.providerLeagueId,
        displayName: league.name,
        season: league.season,
        ...(provider === "espn"
          ? { credentialMode: credentials.espnS2 === undefined ? "public" : "private" }
          : {}),
        ...credentials,
      });
      report(league, { status: "importing" });
      const result = await mutations.importLeague.mutateAsync({
        connectionId: connected.connection.id,
        request: { mode: "create" },
      });
      report(league, { leagueSlug: result.imported.leagueSlug, status: "imported" });
      return true;
    } catch (error) {
      report(league, { ...importFailure(error), status: "error" });
      return false;
    }
  };

  const importLeague = (league: DiscoveredLeague): void => {
    void runImport(league).then(imported => { if (imported) onImported(); });
  };

  const importAll = (): void => {
    void (async () => {
      let anyImported = false;
      for (const league of leagues) {
        if (alreadyHandled(stateFor(league))) continue;
        // Deliberately sequential: a failure on one league must not stop the rest.
        if (await runImport(league)) anyImported = true;
      }
      if (anyImported) onImported();
    })();
  };

  return {
    importAll,
    importLeague,
    reset: () => { setReported({}); },
    running: Object.values(reported).some(isImportRunning),
    states: Object.fromEntries(leagues.map(league => [discoveredLeagueKey(league), stateFor(league)])),
  };
};
