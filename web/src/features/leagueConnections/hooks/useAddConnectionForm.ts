import { useMemo, useState } from "react";
import { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import type {
  DiscoveredLeague,
  LeagueConnection,
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

export type LeagueImportStatus = "idle" | "importing" | "imported" | "linked" | "error";
export interface LeagueImportState {
  readonly status: LeagueImportStatus;
  readonly message?: string;
}

const leagueKey = (league: { providerLeagueId: string; season: string }): string =>
  `${league.providerLeagueId}:${league.season}`;

export const useAddConnectionForm = (
  providers: readonly LeagueConnectionProviderInfo[],
  mutations: ReturnType<typeof useLeagueConnectionMutations>,
  existingConnections: readonly LeagueConnection[] = [],
) => {
  const [provider, setProvider] = useState<LeagueConnectionProvider | undefined>(undefined);
  const [handle, setHandle] = useState("");
  const [espnS2, setEspnS2] = useState("");
  const [swid, setSwid] = useState("");
  const [showCookieStep, setShowCookieStep] = useState(false);
  const [leagues, setLeagues] = useState<readonly DiscoveredLeague[]>([]);
  const [states, setStates] = useState<Record<string, LeagueImportState>>({});
  const chosen = providers.find(candidate => candidate.provider === provider);
  const linkedKeys = useMemo(
    () => new Set(existingConnections.map(leagueKey)),
    [existingConnections],
  );

  const stateFor = (league: DiscoveredLeague): LeagueImportState =>
    states[leagueKey(league)] ?? { status: linkedKeys.has(leagueKey(league)) ? "linked" : "idle" };
  const setLeagueState = (league: DiscoveredLeague, state: LeagueImportState): void => {
    setStates(current => ({ ...current, [leagueKey(league)]: state }));
  };
  const clearResults = (): void => {
    setLeagues([]);
    setStates({});
    mutations.discover.reset();
    mutations.connect.reset();
  };

  const connect = (league: DiscoveredLeague): void => {
    if (provider === undefined) return;
    setLeagueState(league, { status: "importing" });
    mutations.connect.mutate({
      provider,
      providerLeagueId: league.providerLeagueId,
      displayName: league.name,
      season: league.season,
      ...credentialsFor(espnS2, swid),
    }, {
      onSuccess: () => { setLeagueState(league, { status: "imported" }); },
      onError: error => {
        setLeagueState(league, {
          status: "error",
          message: error instanceof Error ? error.message : "Unable to import this league.",
        });
      },
    });
  };

  const connectAll = (): void => {
    if (provider === undefined) return;
    void (async () => {
      for (const league of leagues) {
        const state = stateFor(league);
        if (state.status === "linked" || state.status === "imported") continue;
        setLeagueState(league, { status: "importing" });
        try {
          await mutations.connect.mutateAsync({
            provider,
            providerLeagueId: league.providerLeagueId,
            displayName: league.name,
            season: league.season,
            ...credentialsFor(espnS2, swid),
          });
          setLeagueState(league, { status: "imported" });
        } catch (error) {
          setLeagueState(league, {
            status: "error",
            message: error instanceof Error ? error.message : "Unable to import this league.",
          });
        }
      }
    })();
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

  const selectProvider = (next: LeagueConnectionProvider): void => {
    setProvider(next);
    setShowCookieStep(next === "espn");
    clearResults();
  };
  const leagueStates = Object.fromEntries(leagues.map(league => [leagueKey(league), stateFor(league)]));
  const connecting = Object.values(leagueStates).some(state => state.status === "importing");

  return {
    chosen, connect, connectAll, connecting, espnS2, findLeagues, handle,
    leagueStates, leagues, provider, selectProvider, setEspnS2, setHandle,
    setSwid, showCookieStep, swid,
  };
};
