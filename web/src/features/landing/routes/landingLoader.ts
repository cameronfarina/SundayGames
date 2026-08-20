import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "react-router-dom";
import { getSessionState } from "../../auth/api/authApi";

type SessionStateLoader = (signal: AbortSignal) => Promise<boolean>;

const sessionStateQueryKey = ["session-state"] as const;

/**
 * The landing page exists for people who are not signed in. Anyone who already
 * has a session goes straight to the product rather than reading the pitch
 * again. The check asks an endpoint that answers either way, so a signed-out
 * visitor sees no failed request. When it cannot be reached at all — offline,
 * the platform down — the landing page still renders, because the front door of
 * the site should open even when the rest of it cannot.
 */
export const createLandingLoader = (
  queryClient: QueryClient,
  loadSessionState: SessionStateLoader = signal => getSessionState({ signal }),
) => async (): Promise<Response | null> => {
  try {
    const signedIn = await queryClient.ensureQueryData({
      queryKey: sessionStateQueryKey,
      queryFn: async ({ signal }) => await loadSessionState(signal),
      staleTime: 15_000,
    });
    return signedIn ? redirect("/practice") : null;
  } catch {
    return null;
  }
};
