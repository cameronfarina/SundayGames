import { useState } from "react";
import { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import type {
  DiscoveredLeague,
  LeagueConnectionProvider,
  LeagueConnectionProviderInfo,
} from "../api/leagueConnectionsSchema";
import type { useLeagueConnectionMutations } from "./useLeagueConnectionMutations";

export const currentLeagueSeason = "2026";

const credentialsFor = (espnS2: string, swid: string) => ({
  ...(espnS2.trim() === "" ? {} : { espnS2: espnS2.trim() }),
  ...(swid.trim() === "" ? {} : { swid: swid.trim() }),
});

export const asksForCookies = (error: unknown): boolean =>
  error instanceof PlatformApiError &&
  (error.code === "credentials_required" || error.code === "credentials_rejected");

export const useAddConnectionForm = (
  providers: readonly LeagueConnectionProviderInfo[],
  mutations: ReturnType<typeof useLeagueConnectionMutations>,
) => {
  const [provider, setProvider] = useState<LeagueConnectionProvider | undefined>(undefined);
  const [handle, setHandle] = useState("");
  const [espnS2, setEspnS2] = useState("");
  const [swid, setSwid] = useState("");
  const [showCookieStep, setShowCookieStep] = useState(false);
  const [leagues, setLeagues] = useState<readonly DiscoveredLeague[]>([]);
  const chosen = providers.find(candidate => candidate.provider === provider);

  const clearResults = (): void => {
    setLeagues([]);
    mutations.discover.reset();
    mutations.connect.reset();
  };

  const selectProvider = (next: LeagueConnectionProvider): void => {
    setProvider(next);
    setShowCookieStep(next === "espn");
    clearResults();
  };

  const connect = (league: DiscoveredLeague): void => {
    if (provider === undefined) return;
    mutations.connect.mutate({
      provider,
      providerLeagueId: league.providerLeagueId,
      displayName: league.name,
      season: league.season,
      ...credentialsFor(espnS2, swid),
    }, {
      onSuccess: () => {
        setLeagues(current => current.filter(candidate =>
          candidate.providerLeagueId !== league.providerLeagueId
        ));
      },
    });
  };

  const findLeagues = (): void => {
    if (provider === undefined) return;
    const accountReady = provider === "espn"
      && espnS2.trim().length > 0
      && swid.trim().length > 0;
    if (handle.trim().length === 0 && !accountReady) return;
    clearResults();
    mutations.discover.mutate({
      provider,
      handle: handle.trim(),
      season: currentLeagueSeason,
      ...credentialsFor(espnS2, swid),
    }, {
      onSuccess: result => {
        const only = chosen?.handleNamesOneLeague === true ? result.leagues[0] : undefined;
        if (only !== undefined) connect(only);
        else setLeagues(result.leagues);
      },
      onError: error => { if (asksForCookies(error)) setShowCookieStep(true); },
    });
  };

  return {
    chosen,
    connect,
    espnS2,
    findLeagues,
    handle,
    leagues,
    provider,
    selectProvider,
    setEspnS2,
    setHandle,
    setSwid,
    showCookieStep,
    swid,
  };
};
