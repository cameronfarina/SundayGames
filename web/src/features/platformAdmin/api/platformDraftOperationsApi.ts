import { queryOptions } from "@tanstack/react-query";
import { requestPlatformJson } from "../../../shared/api/http/requestPlatformJson";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import { platformDraftScheduleSchema } from "./platformDraftOperationsSchema";

export const fetchPlatformDraftOperations = async (fetcher?: PlatformFetch) =>
  await requestPlatformJson({
    path: "/api/platform-admin/drafts",
    responseSchema: platformDraftScheduleSchema,
    ...(fetcher === undefined ? {} : { fetcher }),
  });

export const platformDraftOperationsOptions = () => queryOptions({
  queryFn: () => fetchPlatformDraftOperations(),
  queryKey: ["platform-admin", "draft-operations"],
  refetchInterval: 60_000,
});
