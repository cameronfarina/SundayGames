import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { authenticationRequiredEvent } from "../../../../shared/api/http/requestPlatformJson";
import { getSession } from "../../api/authApi";
import type { AuthSession } from "../../api/authSchemas";
import { sessionQueryKey } from "../../api/sessionQuery";
import { resetAccountQueryStateIfUnchanged } from "../../model/accountQueryBoundary";

const confirmedSession = async (signal: AbortSignal): Promise<AuthSession | undefined> => {
  try {
    return await getSession({ signal });
  } catch {
    return undefined;
  }
};

export const ExpiredSessionRecovery = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const recovering = useRef(false);
  const returnTo = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    let active = true;
    let sessionCheck: AbortController | undefined;
    const isActive = () => active;
    const recover = () => {
      if (recovering.current) return;
      recovering.current = true;
      const expectedSession = queryClient.getQueryData<AuthSession>(sessionQueryKey());
      const search = new URLSearchParams({ returnTo });
      const controller = new AbortController();
      sessionCheck = controller;
      void (async () => {
        const currentSession = await confirmedSession(controller.signal);
        if (!isActive()) return;
        if (currentSession !== undefined && currentSession.account.id === expectedSession?.account.id) {
          recovering.current = false;
          return;
        }
        const reset = await resetAccountQueryStateIfUnchanged(
          queryClient,
          expectedSession,
          controller.signal,
          currentSession,
        );
        if (!isActive()) return;
        if (!reset || queryClient.getQueryData(sessionQueryKey()) !== currentSession) {
          recovering.current = false;
          return;
        }
        void navigate(
          currentSession === undefined ? `/login?${search.toString()}` : returnTo,
          { replace: true },
        );
      })();
    };
    window.addEventListener(authenticationRequiredEvent, recover);
    return () => {
      active = false;
      recovering.current = false;
      sessionCheck?.abort();
      window.removeEventListener(authenticationRequiredEvent, recover);
    };
  }, [navigate, queryClient, returnTo]);

  return null;
};
