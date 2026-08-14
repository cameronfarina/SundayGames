import { queryOptions } from "@tanstack/react-query";
import {
  getKeepers,
  getPostDraftTeam,
  getSeasonTeam,
} from "./myTeamApi";

export const seasonTeamQueryOptions = (seasonId: string, enabled: boolean) => queryOptions({
  queryKey: ["season-team", seasonId],
  queryFn: async ({ signal }) => await getSeasonTeam(seasonId, { signal }),
  enabled,
});

export const keepersQueryOptions = (seasonId: string, enabled: boolean) => queryOptions({
  queryKey: ["season-keepers", seasonId],
  queryFn: async ({ signal }) => await getKeepers(seasonId, { signal }),
  enabled,
});

export const postDraftTeamQueryOptions = (roomId: string, enabled: boolean) => queryOptions({
  queryKey: ["post-draft-team", roomId],
  queryFn: async ({ signal }) => await getPostDraftTeam(roomId, { signal }),
  enabled,
});
