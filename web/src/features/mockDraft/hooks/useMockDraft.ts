import {
  skipToken,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import {
  abandonMock,
  createMock,
  loadMock,
  sendMockCommand,
} from "../api/mockDraftApi.js";
import type { MockResponse } from "../api/mockDraftSchemas.js";
import { mockCommand, type MockCommandIntent } from "../model/mockCommand.js";

interface UseAuctionMockDraftInput {
  readonly fetcher?: PlatformFetch;
  readonly initialSessionId?: string;
  readonly onSessionChange?: (sessionId: string | undefined) => void;
  readonly seasonId: string;
  readonly strategy: string;
}

const queryKey = (
  seasonId: string,
  sessionId: string | undefined,
  fetcher: PlatformFetch,
) => [
  "auction-mock",
  seasonId,
  sessionId ?? "inactive",
  fetcher,
];

const auctionMockQueryOptions = (
  seasonId: string,
  sessionId: string | undefined,
  fetcher: PlatformFetch,
) => queryOptions({
  queryFn: sessionId === undefined
    ? skipToken
    : ({ signal }) => loadMock({ seasonId, sessionId, signal }, fetcher),
  queryKey: queryKey(seasonId, sessionId, fetcher),
  staleTime: 15_000,
});

export const useMockDraft = ({
  fetcher = fetch,
  initialSessionId,
  onSessionChange,
  seasonId,
  strategy,
}: UseAuctionMockDraftInput) => {
  const queryClient = useQueryClient();
  const [activeSessionId, setActiveSessionId] = useState(initialSessionId);
  const [abandoned, setAbandoned] = useState(false);
  const sessionQuery = useQuery(auctionMockQueryOptions(seasonId, activeSessionId, fetcher));
  const createMutation = useMutation({
    mutationFn: () => createMock({ seasonId, strategy }, fetcher),
    onSuccess: response => {
      queryClient.setQueryData(queryKey(seasonId, response.mockSession.id, fetcher), response);
      setActiveSessionId(response.mockSession.id);
      setAbandoned(false);
      onSessionChange?.(response.mockSession.id);
    },
  });
  const commandMutation = useMutation({
    mutationFn: (intent: MockCommandIntent) => {
      if (activeSessionId === undefined) return Promise.reject(new Error("No mock session is active."));
      const response = queryClient.getQueryData<MockResponse>(
        queryKey(seasonId, activeSessionId, fetcher),
      );
      if (response === undefined) return Promise.reject(new Error("No mock session is active."));
      return sendMockCommand({
        command: mockCommand(intent, response.state.session.revision),
        seasonId,
        sessionId: activeSessionId,
      }, fetcher);
    },
    onSuccess: response => {
      queryClient.setQueryData(queryKey(seasonId, response.mockSession.id, fetcher), response);
    },
  });
  const abandonMutation = useMutation({
    mutationFn: () => {
      if (activeSessionId === undefined) return Promise.reject(new Error("No mock session is active."));
      const response = queryClient.getQueryData<MockResponse>(
        queryKey(seasonId, activeSessionId, fetcher),
      );
      if (response === undefined) return Promise.reject(new Error("No mock session is active."));
      return abandonMock({
        expectedRevision: response.mockSession.revision,
        seasonId,
        sessionId: activeSessionId,
      }, fetcher);
    },
    onSuccess: response => {
      queryClient.removeQueries({ queryKey: queryKey(seasonId, response.mockSession.id, fetcher) });
      setActiveSessionId(undefined);
      setAbandoned(true);
      onSessionChange?.(undefined);
    },
  });

  return {
    abandon: abandonMutation.mutateAsync,
    abandoned,
    activeSessionId,
    busy: createMutation.isPending || commandMutation.isPending || abandonMutation.isPending,
    command: commandMutation.mutateAsync,
    create: createMutation.mutateAsync,
    error: sessionQuery.error ?? createMutation.error ?? commandMutation.error ?? abandonMutation.error,
    loading: sessionQuery.isLoading,
    response: sessionQuery.data,
  };
};
