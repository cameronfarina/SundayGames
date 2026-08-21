import type { QueryClient } from "@tanstack/react-query";
import type { AuthSession } from "../api/authSchemas";
import { sessionQueryKey } from "../api/sessionQuery";

const accountQueryStateIsCurrent = (
  queryClient: QueryClient,
  expectedSession: AuthSession | undefined,
  signal: AbortSignal,
): boolean => !signal.aborted && queryClient.getQueryData(sessionQueryKey()) === expectedSession;

export const resetAccountQueryState = async (
  queryClient: QueryClient,
  nextSession?: AuthSession,
): Promise<void> => {
  await queryClient.cancelQueries();
  queryClient.clear();
  if (nextSession !== undefined) {
    queryClient.setQueryData(sessionQueryKey(), nextSession);
  }
};

export const resetAccountQueryStateIfUnchanged = async (
  queryClient: QueryClient,
  expectedSession: AuthSession | undefined,
  signal: AbortSignal,
  nextSession?: AuthSession,
): Promise<boolean> => {
  if (!accountQueryStateIsCurrent(queryClient, expectedSession, signal)) return false;
  await queryClient.cancelQueries();
  if (!accountQueryStateIsCurrent(queryClient, expectedSession, signal)) return false;
  queryClient.clear();
  if (nextSession !== undefined) queryClient.setQueryData(sessionQueryKey(), nextSession);
  return true;
};
