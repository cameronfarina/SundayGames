import { useState } from "react";
import type { ConnectionCredentials } from "../api/leagueConnectionsApi";
import type {
  DiscoveredLeague,
  LeagueConnection,
  LeagueConnectionProvider,
  LeagueConnectionProviderInfo,
} from "../api/leagueConnectionsSchema";
import type { LeagueImportStates } from "../lib/discoveredLeagueState";
import { useDiscoveredImports } from "./useDiscoveredImports";
import type { useLeagueConnectionMutations } from "./useLeagueConnectionMutations";

export const currentLeagueSeason = "2026";

const trimmedCredentials = (espnS2: string, swid: string): ConnectionCredentials => ({
  ...(espnS2.trim() === "" ? {} : { espnS2: espnS2.trim() }),
  ...(swid.trim() === "" ? {} : { swid: swid.trim() }),
});

export interface UseAddConnectionFormResult {
  readonly chosen: LeagueConnectionProviderInfo | undefined;
  readonly espnS2: string;
  readonly findLeagues: () => void;
  readonly findLeaguesWithCredentials: () => void;
  readonly handle: string;
  readonly importAll: () => void;
  readonly importLeague: (league: DiscoveredLeague) => void;
  readonly importing: boolean;
  readonly leagueStates: LeagueImportStates;
  readonly leagues: readonly DiscoveredLeague[];
  readonly provider: LeagueConnectionProvider | undefined;
  readonly selectProvider: (next: LeagueConnectionProvider) => void;
  readonly setEspnS2: (value: string) => void;
  readonly setHandle: (value: string) => void;
  readonly setSwid: (value: string) => void;
  readonly swid: string;
}

export const useAddConnectionForm = (
  providers: readonly LeagueConnectionProviderInfo[],
  mutations: ReturnType<typeof useLeagueConnectionMutations>,
  existingConnections: readonly LeagueConnection[] = [],
  initialProvider?: LeagueConnectionProvider,
): UseAddConnectionFormResult => {
  const [provider, setProvider] = useState<LeagueConnectionProvider | undefined>(initialProvider);
  const [handle, setHandle] = useState("");
  const [espnS2, setEspnS2] = useState("");
  const [swid, setSwid] = useState("");
  const [leagues, setLeagues] = useState<readonly DiscoveredLeague[]>([]);
  const [importCredentials, setImportCredentials] = useState<ConnectionCredentials>({});

  const chosen = providers.find(candidate => candidate.provider === provider);
  const clearInputs = (): void => {
    setHandle("");
    setEspnS2("");
    setSwid("");
  };

  const imports = useDiscoveredImports({
    connections: existingConnections,
    credentials: importCredentials,
    leagues,
    mutations,
    onImported: clearInputs,
    provider,
  });

  const clearResults = (): void => {
    setLeagues([]);
    imports.reset();
    mutations.connect.reset();
    mutations.discover.reset();
    mutations.importLeague.reset();
  };

  const search = (searchHandle: string, credentials: ConnectionCredentials): void => {
    if (provider === undefined) return;
    clearResults();
    setImportCredentials(credentials);
    mutations.discover.mutate({
      provider,
      handle: searchHandle,
      season: currentLeagueSeason,
      ...credentials,
    }, { onSuccess: result => { setLeagues(result.leagues); } });
  };

  return {
    chosen,
    espnS2,
    findLeagues: () => {
      if (handle.trim() === "") return;
      search(handle.trim(), {});
    },
    findLeaguesWithCredentials: () => {
      search("", trimmedCredentials(espnS2, swid));
    },
    handle,
    importAll: imports.importAll,
    importLeague: imports.importLeague,
    importing: imports.running,
    leagueStates: imports.states,
    leagues,
    provider,
    selectProvider: (next: LeagueConnectionProvider) => {
      setProvider(next);
      clearInputs();
      setImportCredentials({});
      clearResults();
    },
    setEspnS2,
    setHandle,
    setSwid,
    swid,
  };
};
