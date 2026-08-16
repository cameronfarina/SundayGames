import { queryOptions, useQuery } from "@tanstack/react-query";
import { getPlayerNews } from "../api/playerNewsApi";
import type { PlayerNewsSource } from "../api/playerNewsSchema";

const playerNewsOptions = (
  seasonId: string | undefined,
  source: PlayerNewsSource,
) => queryOptions({
  queryFn: ({ signal }) => getPlayerNews({ ...(seasonId === undefined ? {} : { seasonId }), signal, source }),
  queryKey: ["player-news", seasonId ?? "baseline", source],
  refetchInterval: 300_000,
  staleTime: 300_000,
});

export const usePlayerNewsQuery = (
  seasonId: string | undefined,
  source: PlayerNewsSource,
) => useQuery(playerNewsOptions(seasonId, source));
