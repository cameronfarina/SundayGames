import type { QueryClient } from "@tanstack/react-query";
import { redirect, type LoaderFunction } from "react-router-dom";
import { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import { getSession } from "../api/authApi";
import type { AuthSession } from "../api/authSchemas";
import { sessionQueryKey } from "../api/sessionQuery";

type SessionLoader = (signal?: AbortSignal) => Promise<AuthSession>;

export const createProtectedLoader = (
  queryClient: QueryClient,
  loadSession: SessionLoader = signal => getSession(signal === undefined ? {} : { signal }),
): LoaderFunction => async ({ request }) => {
  try {
    await queryClient.ensureQueryData({
      queryKey: sessionQueryKey(),
      queryFn: async ({ signal }) => await loadSession(signal),
      staleTime: 15_000,
    });
    return null;
  } catch (error: unknown) {
    if (!(error instanceof PlatformApiError) || error.status !== 401) throw error;
    const requestedUrl = new URL(request.url);
    const returnTo = `${requestedUrl.pathname}${requestedUrl.search}${requestedUrl.hash}`;
    return redirect(`/login?${new URLSearchParams({ returnTo }).toString()}`);
  }
};
