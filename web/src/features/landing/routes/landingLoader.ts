import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "react-router-dom";
import { getSession } from "../../auth/api/authApi";
import type { AuthSession } from "../../auth/api/authSchemas";
import { sessionQueryKey } from "../../auth/api/sessionQuery";

type SessionLoader = (signal: AbortSignal) => Promise<AuthSession>;

/**
 * The landing page exists for people who are not signed in. Anyone who already
 * has a session goes straight to the product rather than reading the pitch
 * again. When the session cannot be confirmed at all — expired, offline, the
 * platform down — the landing page still renders, because the front door of the
 * site should open even when the rest of it cannot.
 */
export const createLandingLoader = (
  queryClient: QueryClient,
  loadSession: SessionLoader = signal => getSession({ signal }),
) => async (): Promise<Response | null> => {
  try {
    await queryClient.ensureQueryData({
      queryKey: sessionQueryKey(),
      queryFn: async ({ signal }) => await loadSession(signal),
      staleTime: 15_000,
    });
  } catch {
    return null;
  }

  return redirect("/practice");
};
