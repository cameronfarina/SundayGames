import { queryOptions, useQuery } from "@tanstack/react-query";
import {
  getLeagueConnectionDetail,
  getLeagueConnections,
} from "../api/leagueConnectionsApi";

type ConnectionListKey = readonly ["league-connections", "list"];
type ConnectionDetailKey = readonly ["league-connections", "detail", string];

export const leagueConnectionQueryKeys = {
  detail: (connectionId: string): ConnectionDetailKey =>
    ["league-connections", "detail", connectionId],
  list: (): ConnectionListKey => ["league-connections", "list"],
};

const connectionListOptions = () => queryOptions({
  queryFn: ({ signal }) => getLeagueConnections(signal),
  queryKey: leagueConnectionQueryKeys.list(),
});

const connectionDetailOptions = (connectionId: string) => queryOptions({
  queryFn: ({ signal }) => getLeagueConnectionDetail(connectionId, signal),
  queryKey: leagueConnectionQueryKeys.detail(connectionId),
});

export const useLeagueConnectionsQuery = () => useQuery(connectionListOptions());

export const useLeagueConnectionDetailQuery = (connectionId: string | undefined) => useQuery({
  ...connectionDetailOptions(connectionId ?? ""),
  enabled: connectionId !== undefined,
});
