import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  connectLeague,
  discoverLeagues,
  removeLeagueConnection,
  syncLeagueConnection,
  type ConnectLeagueRequest,
  type DiscoverLeaguesRequest,
} from "../api/leagueConnectionsApi";
import { leagueConnectionQueryKeys } from "./useLeagueConnectionQueries";
import { seasonQueryKeys } from "../../../shared/api/queries/seasonQueryKeys";

export const useLeagueConnectionMutations = () => {
  const client = useQueryClient();
  const refreshList = async (): Promise<void> => {
    await client.invalidateQueries({ queryKey: leagueConnectionQueryKeys.list() });
  };
  const refreshOnboarding = async (): Promise<void> => {
    await client.invalidateQueries({ exact: true, queryKey: seasonQueryKeys.onboarding() });
  };

  const discover = useMutation({
    mutationFn: (request: DiscoverLeaguesRequest) => discoverLeagues(request),
  });
  const connect = useMutation({
    mutationFn: (request: ConnectLeagueRequest) => connectLeague(request),
    onSuccess: async () => { await Promise.all([refreshList(), refreshOnboarding()]); },
  });
  const sync = useMutation({
    mutationFn: (connectionId: string) => syncLeagueConnection(connectionId),
    onSuccess: async (_result, connectionId) => {
      await Promise.all([
        refreshList(),
        client.invalidateQueries({ queryKey: leagueConnectionQueryKeys.detail(connectionId) }),
      ]);
    },
  });
  const remove = useMutation({
    mutationFn: (connectionId: string) => removeLeagueConnection(connectionId),
    onSuccess: refreshList,
  });

  return { connect, discover, remove, sync };
};
