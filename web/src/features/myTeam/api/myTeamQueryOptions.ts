import { queryOptions } from "@tanstack/react-query";
import { seasonQueryKeys } from "../../../shared/api/queries/seasonQueryKeys";
import {
  getInSeasonTeam,
  getKeepers,
  getPostDraftTeam,
  getSeasonTeam,
} from "./myTeamApi";

export const seasonTeamQueryOptions = (seasonId: string, enabled: boolean) => queryOptions({
  queryKey: seasonQueryKeys.seasonTeam(seasonId),
  queryFn: async ({ signal }) => await getSeasonTeam(seasonId, { signal }),
  enabled,
});

export const keepersQueryOptions = (seasonId: string, enabled: boolean) => queryOptions({
  queryKey: seasonQueryKeys.seasonKeepers(seasonId),
  queryFn: async ({ signal }) => await getKeepers(seasonId, { signal }),
  enabled,
});

export const postDraftTeamQueryOptions = (roomId: string, enabled: boolean) => queryOptions({
  queryKey: ["post-draft-team", roomId],
  queryFn: async ({ signal }) => await getPostDraftTeam(roomId, { signal }),
  enabled,
});

// The lineup and waiver tabs read the same payload, so switching between them
// costs no extra request.
export const inSeasonQueryOptions = (roomId: string, enabled: boolean) => queryOptions({
  queryKey: ["in-season-team", roomId],
  queryFn: async ({ signal }) => await getInSeasonTeam(roomId, { signal }),
  enabled,
});
