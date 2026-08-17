import { queryOptions, useQuery } from "@tanstack/react-query";
import { getPlayerNews } from "../api/playerNewsApi";

const playerNewsOptions = (seasonId: string | undefined) => queryOptions({
  queryFn: ({ signal }) => getPlayerNews({ ...(seasonId === undefined ? {} : { seasonId }), signal }),
  queryKey: ["player-news", seasonId ?? "baseline"],
  refetchInterval: 300_000,
  staleTime: 300_000,
});

export const usePlayerNewsQuery = (seasonId: string | undefined) =>
  useQuery(playerNewsOptions(seasonId));
