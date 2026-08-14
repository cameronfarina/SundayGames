import type { QueryClient } from "@tanstack/react-query";
import type { AuthSession } from "../api/authSchemas";
import { sessionQueryKey } from "../api/sessionQuery";

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
