import { useMemo, useState } from "react";
import { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import type {
  DiscoveredLeague,
  LeagueConnection,
  LeagueConnectionProvider,
  LeagueConnectionProviderInfo,
} from "../api/leagueConnectionsSchema";
import type { ConnectLeagueRequest } from "../api/leagueConnectionsApi";
import type { useLeagueConnectionMutations } from "./useLeagueConnectionMutations";

export const currentLeagueSeason = "2026";
export const newLeagueImportTarget = "new";

const credentialsFor = (espnS2: string, swid: string) => ({
  ...(espnS2.trim() === "" ? {} : { espnS2: espnS2.trim() }),
  ...(swid.trim() === "" ? {} : { swid: swid.trim() }),
});

export const asksForCookies = (error: unknown): boolean =>
  error instanceof PlatformApiError &&
  (error.code === "credentials_required" || error.code === "credentials_rejected");

export type LeagueImportStatus =
  | "idle"
  | "importing"
  | "imported"
  | "linked"
  | "needs_attention"
  | "error";
export interface LeagueImportState {
  readonly status: LeagueImportStatus;
  readonly message?: string;
}

const leagueKey = (league: { providerLeagueId: string; season: string }): string =>
  `${league.providerLeagueId}:${league.season}`;

const completedStateFor = (connection: LeagueConnection): LeagueImportState => {
  if (connection.linkedSeasonId !== undefined) return { status: "imported" };
  if (connection.status === "needs_attention") {
    return {
      status: "needs_attention",
      message: connection.statusDetail ?? "This league needs review before it can be imported.",
    };
  }
  return {
    status: "error",
    message: connection.statusDetail ?? "Sunday Games synced this league but could not import it.",
  };
};

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
  const [targets, setTargets] = useState<Record<string, string>>({});
  const chosen = providers.find(candidate => candidate.provider === provider);
  const linkedKeys = useMemo(
    () => new Set(existingConnections.flatMap(connection =>
      connection.linkedSeasonId === undefined ? [] : [leagueKey(connection)])),
    [existingConnections],
  );

  const stateFor = (league: DiscoveredLeague): LeagueImportState =>
    states[leagueKey(league)] ?? { status: linkedKeys.has(leagueKey(league)) ? "linked" : "idle" };
  const targetFor = (league: DiscoveredLeague): string =>
    targets[leagueKey(league)] ?? newLeagueImportTarget;
  const setLeagueState = (league: DiscoveredLeague, state: LeagueImportState): void => {
    setStates(current => ({ ...current, [leagueKey(league)]: state }));
  };
  const setTarget = (league: DiscoveredLeague, targetSeasonId: string): void => {
    setTargets(current => ({ ...current, [leagueKey(league)]: targetSeasonId }));
  };
  const clearResults = (): void => {
    setLeagues([]);
    setStates({});
    setTargets({});
    mutations.discover.reset();
    mutations.connect.reset();
  };

  const requestFor = (league: DiscoveredLeague): ConnectLeagueRequest => {
    if (provider === undefined) throw new Error("Choose a provider before importing a league.");
    const targetSeasonId = targetFor(league);
    return {
      provider,
      providerLeagueId: league.providerLeagueId,
      displayName: league.name,
      season: league.season,
      ...credentialsFor(espnS2, swid),
      ...(targetSeasonId === newLeagueImportTarget ? {} : { targetSeasonId }),
    };
  };

  const connect = (league: DiscoveredLeague): void => {
    if (provider === undefined) return;
    setLeagueState(league, { status: "importing" });
    mutations.connect.mutate(requestFor(league), {
      onSuccess: result => { setLeagueState(league, completedStateFor(result.connection)); },
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
          const result = await mutations.connect.mutateAsync(requestFor(league));
          setLeagueState(league, completedStateFor(result.connection));
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
  const targetSeasonIds = Object.fromEntries(leagues.map(league => [leagueKey(league), targetFor(league)]));
  const connecting = Object.values(leagueStates).some(state => state.status === "importing");

  return {
    chosen, connect, connectAll, connecting, espnS2, findLeagues, handle,
    leagueStates, leagues, provider, selectProvider, setEspnS2, setHandle,
    setSwid, setTarget, showCookieStep, swid, targetSeasonIds,
  };
};
