import { queryOptions, useQuery } from "@tanstack/react-query";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import { getSession } from "./authApi";

export const sessionQueryOptions = (fetcher?: PlatformFetch) => queryOptions({
  queryFn: ({ signal }) => getSession({
    ...(fetcher === undefined ? {} : { fetcher }),
    signal,
  }),
  queryKey: ["session", fetcher],
  staleTime: 15_000,
});

export const useSessionQuery = (fetcher?: PlatformFetch) => useQuery(sessionQueryOptions(fetcher));
