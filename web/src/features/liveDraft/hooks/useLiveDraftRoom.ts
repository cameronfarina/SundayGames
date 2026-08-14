import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  createLiveDraftExport,
  getLiveDraftRoom,
  mutateLiveDraftRoom,
} from "../api/liveDraftApi";
import {
  liveDraftRoomCacheUpdate,
  type LiveDraftRoomEventName,
} from "../api/liveDraftRoomCache";
import type { LiveDraftRoom } from "../api/liveDraftSchemas";
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
  const applyRoomUpdate = useCallback((event: LiveDraftRoomEventName, incoming: LiveDraftRoom) => {
    let shouldRefetch = false;
    queryClient.setQueryData<LiveDraftRoom>(liveDraftRoomQueryKey(roomId), current => {
      const update = liveDraftRoomCacheUpdate(current, event, incoming);
      if (update.type === "refetch") {
        shouldRefetch = true;
        return current;
      }
      return update.type === "applied" ? update.room : current;
    });

    return !shouldRefetch;
  }, [queryClient, roomId]);
  const revision = roomQuery.data?.revision;
  const connection = useLiveDraftUpdates(revision === undefined
    ? { applyRoomUpdate, refresh, roomId }
    : { applyRoomUpdate, refresh, revision, roomId });
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
