import type { DraftLoadMutation, DraftMutationAction } from "./manifest.js";
import type { OpenDraftStreamBatchResult } from "./draftStreams.js";
import { runAuthenticatedHttpBurst } from "./httpBurst.js";
import type { LoadMeasurement } from "./metrics.js";

export interface RoomDraftLoadMutation extends DraftLoadMutation {
  readonly roomId: string;
}

export interface RunDraftMutationLoadInput {
  readonly baseUrl: URL;
  readonly clientsPerRoom: number;
  readonly eventTimeoutMs: number;
  readonly mutations: readonly RoomDraftLoadMutation[];
  readonly paceMs: number;
  readonly streams: OpenDraftStreamBatchResult;
}

export interface DraftMutationLoadResult {
  readonly fanoutMeasurements: readonly LoadMeasurement[];
  readonly mutationMeasurements: readonly LoadMeasurement[];
  readonly reconnectMeasurements: readonly LoadMeasurement[];
}

const eventForAction = (action: DraftMutationAction): string => {
  switch (action) {
    case "start": return "room.started";
    case "pause": return "room.paused";
    case "resume": return "room.resumed";
    case "sales": return "room.sale";
    case "end": return "room.ended";
    case "reopen": case "undo": case "corrections": return "room.snapshot";
  }
};

const sleep = async (durationMs: number): Promise<void> => {
  if (durationMs > 0) await new Promise<void>(resolve => setTimeout(resolve, durationMs));
};

const failedFanout = (count: number): readonly LoadMeasurement[] =>
  Array.from({ length: count }, () => ({
    diagnostic: "mutation_failed_before_fanout",
    durationMs: 0,
    ok: false,
  }));

export const runDraftMutationLoad = async (
  input: RunDraftMutationLoadInput,
): Promise<DraftMutationLoadResult> => {
  const roomResults = await Promise.all(input.mutations.map(async (mutation, index) => {
    await sleep(index * input.paceMs);
    const [reconnect] = await input.streams.reconnectFirstClientPerRoom([mutation.roomId]);
    const [mutationResult] = await runAuthenticatedHttpBurst(input.baseUrl, [{
      body: mutation.body,
      method: "POST",
      path: `/live-rooms/${encodeURIComponent(mutation.roomId)}/${mutation.action}`,
      responseKind: "live-room-mutation",
      roomId: mutation.roomId,
      sessionToken: mutation.sessionToken,
    }]);
    const fanout = mutationResult?.roomRevision === undefined
      ? failedFanout(input.clientsPerRoom)
      : await input.streams.waitForRoomEvent({
          event: eventForAction(mutation.action),
          revision: mutationResult.roomRevision,
          roomId: mutation.roomId,
          timeoutMs: input.eventTimeoutMs,
        });
    return {
      fanout,
      mutation: mutationResult ?? {
        diagnostic: "missing_mutation_response",
        durationMs: 0,
        ok: false,
      },
      reconnect: reconnect ?? {
        diagnostic: "missing_reconnect_measurement",
        durationMs: 0,
        ok: false,
      },
    };
  }));
  return {
    fanoutMeasurements: roomResults.flatMap(result => result.fanout),
    mutationMeasurements: roomResults.map(result => result.mutation),
    reconnectMeasurements: roomResults.map(result => result.reconnect),
  };
};
