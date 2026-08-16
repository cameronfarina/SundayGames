import { queryOptions, skipToken, useQuery } from "@tanstack/react-query";
import { getPlayerNews } from "../api/playerNewsApi";
import type { PlayerNewsSource } from "../api/playerNewsSchema";

const playerNewsOptions = (
  seasonId: string | undefined,
  source: PlayerNewsSource,
) => queryOptions({
  queryFn: seasonId === undefined
    ? skipToken
    : ({ signal }) => getPlayerNews({ seasonId, signal, source }),
  queryKey: ["my-team", "player-news", seasonId ?? "none", source],
  refetchInterval: 300_000,
  staleTime: 300_000,
});

export const usePlayerNewsQuery = (
  seasonId: string | undefined,
  source: PlayerNewsSource,
) => useQuery(playerNewsOptions(seasonId, source));
