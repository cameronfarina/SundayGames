import { queryOptions, useQuery } from "@tanstack/react-query";
import { getLiveDraftAdvisory } from "../api/liveDraftAdvisoryApi";
import type { LiveDraftAdvisory } from "../api/liveDraftAdvisorySchemas";

const advisoryStaleTimeMs = 5 * 60 * 1000;

export const liveDraftAdvisoryQueryKey = (roomId: string): readonly [string, string] =>
  ["live-draft-advisory", roomId];

const liveDraftAdvisoryOptions = (roomId: string) => queryOptions({
  queryKey: liveDraftAdvisoryQueryKey(roomId),
  queryFn: async ({ signal }) => await getLiveDraftAdvisory(roomId, { signal }),
  // Advisory data refreshes every six hours upstream, and a failure here must
  // never disturb bidding, so the room renders without it rather than retrying.
  retry: false,
  staleTime: advisoryStaleTimeMs,
});

export const useLiveDraftAdvisory = (roomId: string): LiveDraftAdvisory | undefined =>
  useQuery(liveDraftAdvisoryOptions(roomId)).data;
