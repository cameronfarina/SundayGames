import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  createLiveDraftExport,
  getLiveDraftRoom,
  mutateLiveDraftRoom,
} from "../api/liveDraftApi";
import type { LiveDraftAction } from "../lib/liveDraftMutation";
import { buildLiveDraftMutation } from "../lib/liveDraftMutation";
import { useLiveDraftUpdates } from "./useLiveDraftUpdates";

export const liveDraftRoomQueryKey = (roomId: string): readonly [string, string] =>
  ["live-draft-room", roomId];

const liveDraftRoomOptions = (roomId: string) => queryOptions({
  queryKey: liveDraftRoomQueryKey(roomId),
  queryFn: async ({ signal }) => await getLiveDraftRoom(roomId, undefined, { signal }),
});

export const useLiveDraftRoom = (roomId: string) => {
  const queryClient = useQueryClient();
  const roomQuery = useQuery(liveDraftRoomOptions(roomId));
  const { isPending: roomIsPending, mutateAsync: mutateRoom } = useMutation({
    mutationFn: mutateLiveDraftRoom,
    onSuccess: room => queryClient.setQueryData(liveDraftRoomQueryKey(roomId), room),
  });
  const { isPending: exportIsPending, mutateAsync: createExport } = useMutation({
    mutationFn: async () => await createLiveDraftExport(roomId, new Date().toISOString()),
  });
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: liveDraftRoomQueryKey(roomId) });
  }, [queryClient, roomId]);
  const revision = roomQuery.data?.revision;
  const connection = useLiveDraftUpdates(revision === undefined
    ? { refresh, roomId }
    : { refresh, revision, roomId });
  const runAction = useCallback(async (action: LiveDraftAction) => {
    if (revision === undefined) throw new Error("The draft room has not loaded yet.");
    return await mutateRoom(buildLiveDraftMutation(action, {
      expectedRevision: revision,
      idempotencyKey: `${action.action}:${roomId}:${String(revision)}:${crypto.randomUUID()}`,
      roomId,
    }));
  }, [mutateRoom, revision, roomId]);

  return {
    busy: roomIsPending || exportIsPending,
    connection,
    createExport,
    error: roomQuery.error,
    loading: roomQuery.isLoading,
    refresh,
    room: roomQuery.data,
    runAction,
  };
};
