import { requestPlatformJson } from "../../../shared/api/http/requestPlatformJson";
import {
  connectionMutationSchema,
  connectionRemovalSchema,
  discoveredLeaguesSchema,
  leagueConnectionDetailSchema,
  leagueConnectionListSchema,
  type LeagueConnectionProvider,
} from "./leagueConnectionsSchema";

export interface ConnectionCredentials {
  readonly espnS2?: string;
  readonly swid?: string;
}

export interface DiscoverLeaguesRequest extends ConnectionCredentials {
  readonly handle: string;
  readonly provider: LeagueConnectionProvider;
  readonly season: string;
}

export interface ConnectLeagueRequest extends ConnectionCredentials {
  readonly displayName: string;
  readonly provider: LeagueConnectionProvider;
  readonly providerLeagueId: string;
  readonly season: string;
  readonly targetSeasonId?: string;
}

const connectionsPath = "/league-connections";

const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const getLeagueConnections = async (signal?: AbortSignal) =>
  await requestPlatformJson({
    path: connectionsPath,
    responseSchema: leagueConnectionListSchema,
    ...(signal === undefined ? {} : { init: { signal } }),
  });

export const getLeagueConnectionDetail = async (connectionId: string, signal?: AbortSignal) =>
  await requestPlatformJson({
    path: `${connectionsPath}/${encodeURIComponent(connectionId)}`,
    responseSchema: leagueConnectionDetailSchema,
    ...(signal === undefined ? {} : { init: { signal } }),
  });

export const discoverLeagues = async (request: DiscoverLeaguesRequest) =>
  await requestPlatformJson({
    path: `${connectionsPath}/discover`,
    init: jsonRequest("POST", request),
    responseSchema: discoveredLeaguesSchema,
  });

export const connectLeague = async (request: ConnectLeagueRequest) =>
  await requestPlatformJson({
    path: connectionsPath,
    init: jsonRequest("POST", request),
    responseSchema: connectionMutationSchema,
  });

export const syncLeagueConnection = async (connectionId: string) =>
  await requestPlatformJson({
    path: `${connectionsPath}/${encodeURIComponent(connectionId)}/sync`,
    init: jsonRequest("POST", {}),
    responseSchema: connectionMutationSchema,
  });

export const removeLeagueConnection = async (connectionId: string) =>
  await requestPlatformJson({
    path: `${connectionsPath}/${encodeURIComponent(connectionId)}`,
    init: jsonRequest("DELETE", {}),
    responseSchema: connectionRemovalSchema,
  });
