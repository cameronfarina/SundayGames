import { DraftStreamConnection } from "./draftStreamConnection.js";
import type { DraftStreamClient, ExpectedDraftEvent } from "./draftStreamContracts.js";
import type { LoadMeasurement } from "./metrics.js";

export type { DraftStreamClient } from "./draftStreamContracts.js";

export interface OpenDraftStreamBatchInput {
  readonly baseUrl: URL;
  readonly clients: readonly DraftStreamClient[];
  readonly connectTimeoutMs?: number | undefined;
}

export interface WaitForRoomEventInput extends ExpectedDraftEvent {
  readonly roomId: string;
}

export interface ExpectedRoomRevision {
  readonly revision: number;
  readonly roomId: string;
}

export interface OpenDraftStreamBatchResult {
  readonly measurements: readonly LoadMeasurement[];
  close(): Promise<void>;
  reconnectFirstClientPerRoom(rooms: readonly ExpectedRoomRevision[]): Promise<readonly LoadMeasurement[]>;
  runtimeDiagnostics(): Readonly<Record<string, number>>;
  unexpectedClosureCount(): number;
  waitForRoomEvent(input: WaitForRoomEventInput): Promise<readonly LoadMeasurement[]>;
}

export const openDraftStreamBatch = async (
  input: OpenDraftStreamBatchInput,
): Promise<OpenDraftStreamBatchResult> => {
  const diagnostics: Record<string, number> = {};
  const runtimeFailure = (diagnostic: string): void => {
    diagnostics[diagnostic] = (diagnostics[diagnostic] ?? 0) + 1;
  };
  const createConnection = (client: DraftStreamClient): DraftStreamConnection =>
    new DraftStreamConnection(client, input.baseUrl, input.connectTimeoutMs ?? 10_000, runtimeFailure);
  const connections = input.clients.map(createConnection);
  const measurements = await Promise.all(connections.map(async connection => await connection.open()));
  let closed = false;
  return {
    measurements,
    runtimeDiagnostics: () => ({ ...diagnostics }),
    unexpectedClosureCount: () => Object.values(diagnostics).reduce((sum, count) => sum + count, 0),
    async reconnectFirstClientPerRoom(rooms): Promise<readonly LoadMeasurement[]> {
      const uniqueRooms = [...new Map(rooms.map(room => [room.roomId, room])).values()];
      return await Promise.all(uniqueRooms.map(async room => {
        const { roomId } = room;
        const index = connections.findIndex(connection => connection.client.roomId === roomId);
        const previous = connections[index];
        if (index < 0 || previous === undefined) {
          return { diagnostic: "missing_room_stream", durationMs: 0, ok: false };
        }
        await previous.close();
        const replacement = createConnection(previous.client);
        connections[index] = replacement;
        return await replacement.open(room.revision);
      }));
    },
    async waitForRoomEvent(expected): Promise<readonly LoadMeasurement[]> {
      const roomConnections = connections.filter(connection => connection.client.roomId === expected.roomId);
      return await Promise.all(roomConnections.map(async connection => await connection.waitForEvent(expected)));
    },
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      await Promise.allSettled(connections.map(async connection => await connection.close()));
    },
  };
};
