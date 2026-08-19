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

/** The provider told us this league is private and needs a signed-in browser's cookies. */
export const asksForCookies = (error: unknown): boolean =>
  error instanceof PlatformApiError &&
  (error.code === "credentials_required" || error.code === "credentials_rejected");

export type LeagueImportStatus = "idle" | "importing" | "imported" | "linked" | "error";

export interface LeagueImportState {
  readonly status: LeagueImportStatus;
  readonly message?: string;
}

export interface UseAddConnectionFormResult {
  readonly chosen: LeagueConnectionProviderInfo | undefined;
  readonly connect: (league: DiscoveredLeague) => void;
  readonly connectAll: () => void;
  readonly connecting: boolean;
  readonly espnS2: string;
  readonly findLeagues: () => void;
  readonly handle: string;
  readonly leagueStates: Record<string, LeagueImportState>;
  readonly leagues: readonly DiscoveredLeague[];
  readonly provider: LeagueConnectionProvider | undefined;
  readonly selectProvider: (next: LeagueConnectionProvider) => void;
  readonly setEspnS2: (value: string) => void;
  readonly setHandle: (value: string) => void;
  readonly setSwid: (value: string) => void;
  readonly showCookieStep: boolean;
  readonly swid: string;
}

const leagueStateKey = (league: DiscoveredLeague): string => `${league.providerLeagueId}:${league.season}`;

const stateKeyForConnections = (connection: LeagueConnection): string =>
  `${connection.providerLeagueId}:${connection.season}`;

const blankMessage = "Could not connect this league. Check the connection details and try again.";

export const useAddConnectionForm = (
  providers: readonly LeagueConnectionProviderInfo[],
  mutations: ReturnType<typeof useLeagueConnectionMutations>,
  existingConnections: readonly LeagueConnection[] = [],
): UseAddConnectionFormResult => {
  const [provider, setProvider] = useState<LeagueConnectionProvider | undefined>(undefined);
  const [handle, setHandle] = useState("");
  const [espnS2, setEspnS2] = useState("");
  const [swid, setSwid] = useState("");
  const [showCookieStep, setShowCookieStep] = useState(false);
  const [leagues, setLeagues] = useState<readonly DiscoveredLeague[]>([]);
  const [leagueStates, setLeagueStates] = useState<Record<string, LeagueImportState>>({});

  const chosen = providers.find(candidate => candidate.provider === provider);
  const linkedConnectionKeys = useMemo(() => new Set(existingConnections.map(stateKeyForConnections)), [existingConnections]);

  const deriveLeagueState = (league: DiscoveredLeague): LeagueImportState =>
    leagueStates[leagueStateKey(league)]
      ?? { status: linkedConnectionKeys.has(leagueStateKey(league)) ? "linked" : "idle" };

  const clearResults = (): void => {
    setLeagues([]);
    setLeagueStates({});
    mutations.discover.reset();
    mutations.connect.reset();
  };

  const clearInputs = (): void => {
    setHandle("");
    setEspnS2("");
    setSwid("");
    setShowCookieStep(false);
  };

  const setLeagueState = (league: DiscoveredLeague, state: LeagueImportState): void => {
    setLeagueStates(previous => ({ ...previous, [leagueStateKey(league)]: state }));
  };

  const connect = (league: DiscoveredLeague): void => {
    if (provider === undefined) return;
    const key = leagueStateKey(league);
    setLeagueState(league, {
      ...(leagueStates[key] === undefined ? {} : { message: leagueStates[key]?.message }),
      status: "importing",
    });
    mutations.connect.mutate({
      provider,
      providerLeagueId: league.providerLeagueId,
      displayName: league.name,
      season: league.season,
      ...credentialsFor(espnS2, swid),
    }, {
      onSuccess: () => {
        setLeagueState(league, { status: "imported" });
        clearInputs();
      },
      onError: error => {
        const message = error instanceof Error ? error.message : blankMessage;
        setLeagueState(league, { status: "error", message });
      },
    });
  };

  const connectAll = (): void => {
    if (provider === undefined) return;
    void (async () => {
      let didConnect = false;
      for (const league of leagues) {
        const state = deriveLeagueState(league);
        if (state.status === "importing") continue;
        const request = async () => {
          try {
            setLeagueState(league, { status: "importing" });
            await mutations.connect.mutateAsync({
              provider,
              providerLeagueId: league.providerLeagueId,
              displayName: league.name,
              season: league.season,
              ...credentialsFor(espnS2, swid),
            });
            setLeagueState(league, { status: "imported" });
            didConnect = true;
          } catch (error) {
            const message = error instanceof Error ? error.message : blankMessage;
            setLeagueState(league, { status: "error", message });
            throw error;
          }
        };
        try {
          await request();
        } catch {
          // Continue trying each league so every importable league gets a status.
        }
      }
      if (didConnect) clearInputs();
    })();
  };

  const findLeagues = (): void => {
    if (provider === undefined || handle.trim() === "") return;
    clearResults();
    mutations.discover.mutate({
      provider,
      handle: handle.trim(),
      season: currentLeagueSeason,
      ...credentialsFor(espnS2, swid),
    }, {
      // One handle can name many Sleeper leagues but only ever one ESPN league,
      // so ESPN skips the pick-a-league step entirely.
      onSuccess: result => {
        const only = chosen?.handleNamesOneLeague === true ? result.leagues[0] : undefined;
        if (only !== undefined) {
          connect(only);
        } else {
          setLeagues(result.leagues);
          setLeagueStates(
            Object.fromEntries(result.leagues.map(league => {
              const key = leagueStateKey(league);
              const state = leagueStates[key];
              const defaultStatus: LeagueImportState =
                linkedConnectionKeys.has(key) ? { status: "linked" } : { status: "idle" };
              return [key, state?.status === "error" ? state : defaultStatus];
            })),
          );
        }
      },
      onError: error => {
        if (asksForCookies(error)) setShowCookieStep(true);
      },
    });
  };

  const selectProvider = (next: LeagueConnectionProvider): void => {
    setProvider(next);
    setShowCookieStep(false);
    clearResults();
  };

  const anyImporting = useMemo(() => Object.values(leagueStates)
    .some(state => state.status === "importing"), [leagueStates]);

  return {
    chosen,
    connect,
    connectAll,
    connecting: mutations.connect.isPending || anyImporting,
    espnS2,
    findLeagues,
    handle,
    leagueStates: Object.fromEntries(leagues.map(league => {
      const key = leagueStateKey(league);
      return [key, deriveLeagueState(league)];
    })),
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
