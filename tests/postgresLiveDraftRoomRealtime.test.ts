import { describe, expect, it } from "vitest";
import type {
  PostgresNotificationClient,
  PostgresNotificationSubscription,
} from "../src/platform/postgresClient.js";
import type { PostgresQueryResult } from "../src/platform/postgresPlatformStore.js";
import {
  decodeLiveDraftRoomRevisionNotification,
  LiveDraftRoomRevisionNotifier,
  publishLiveDraftRoomRevision,
  startPostgresLiveDraftRoomRevisionListener,
} from "../src/platform/liveDraftRoomRealtime.js";

class SharedNotificationBus {
  readonly listeners = new Set<(payload: string) => void>();

  publish(payload: string): void {
    for (const listener of this.listeners) listener(payload);
  }
}

class FakeCrossInstanceClient implements PostgresNotificationClient {
  readonly queries: Array<{ text: string; values: readonly unknown[] }> = [];

  constructor(private readonly bus: SharedNotificationBus) {}

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    this.queries.push({ text, values });
    if (text === "SELECT pg_notify($1, $2)") this.bus.publish(String(values[1]));
    return { rows: [] };
  }

  async listen(
    _channel: string,
    onPayload: (payload: string) => void,
  ): Promise<PostgresNotificationSubscription> {
    this.bus.listeners.add(onPayload);
    return { close: async () => { this.bus.listeners.delete(onPayload); } };
  }
}

describe("Postgres live-draft revision channel", () => {
  it("wakes a waiter on another application instance without waiting for recovery", async () => {
    const bus = new SharedNotificationBus();
    const firstClient = new FakeCrossInstanceClient(bus);
    const secondClient = new FakeCrossInstanceClient(bus);
    const firstNotifier = new LiveDraftRoomRevisionNotifier();
    const secondNotifier = new LiveDraftRoomRevisionNotifier();
    const firstListener = await startPostgresLiveDraftRoomRevisionListener(
      firstClient,
      firstNotifier,
    );
    const secondListener = await startPostgresLiveDraftRoomRevisionListener(
      secondClient,
      secondNotifier,
    );
    const wait = secondNotifier.waitForRevision({
      accountId: "account_seth",
      roomId: "room_sunday",
      afterRevision: 1,
      timeoutMs: 1_000,
    });

    await publishLiveDraftRoomRevision(firstClient, "room_sunday", 2);

    await expect(wait).resolves.toBe(true);
    expect(firstClient.queries).toEqual([{
      text: "SELECT pg_notify($1, $2)",
      values: [
        "sunday_games_live_draft_room_revision",
        '{"roomId":"room_sunday","revision":2}',
      ],
    }]);
    expect(decodeLiveDraftRoomRevisionNotification(
      String(firstClient.queries[0]?.values[1]),
    )).toEqual({ roomId: "room_sunday", revision: 2 });

    await Promise.all([firstListener.close(), secondListener.close()]);
    expect(bus.listeners).toHaveLength(0);
  });
});
