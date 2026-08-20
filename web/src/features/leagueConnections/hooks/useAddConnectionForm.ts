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
  readonly findAccountLeagues: () => void;
  readonly findLeagues: () => void;
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
): UseAddConnectionFormResult => {
  const [provider, setProvider] = useState<LeagueConnectionProvider | undefined>(undefined);
  const [handle, setHandle] = useState("");
  const [espnS2, setEspnS2] = useState("");
  const [swid, setSwid] = useState("");
  const [leagues, setLeagues] = useState<readonly DiscoveredLeague[]>([]);

  const chosen = providers.find(candidate => candidate.provider === provider);
  const credentials = trimmedCredentials(espnS2, swid);
  const clearInputs = (): void => {
    setHandle("");
    setEspnS2("");
    setSwid("");
  };

  const imports = useDiscoveredImports({
    connections: existingConnections,
    credentials,
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

  const search = (searchHandle: string): void => {
    if (provider === undefined) return;
    clearResults();
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
    // An account-wide search names no league at all: the cookies are the whole
    // question, so ESPN answers with every league the account plays in.
    findAccountLeagues: () => {
      if (credentials.espnS2 === undefined || credentials.swid === undefined) return;
      search("");
    },
    findLeagues: () => {
      if (handle.trim() === "") return;
      search(handle.trim());
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
      clearResults();
    },
    setEspnS2,
    setHandle,
    setSwid,
    swid,
  };
};
