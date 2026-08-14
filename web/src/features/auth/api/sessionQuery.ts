import { queryOptions, useQuery } from "@tanstack/react-query";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import { getSession } from "./authApi";

type SessionQueryKey = readonly ["session", PlatformFetch | undefined];

export const sessionQueryKey = (fetcher?: PlatformFetch): SessionQueryKey => ["session", fetcher];

export const sessionQueryOptions = (fetcher?: PlatformFetch) => queryOptions({
  queryFn: ({ signal }) => getSession({
    ...(fetcher === undefined ? {} : { fetcher }),
    signal,
  }),
  queryKey: sessionQueryKey(fetcher),
  staleTime: 15_000,
});

export const useSessionQuery = (fetcher?: PlatformFetch) => useQuery(sessionQueryOptions(fetcher));
