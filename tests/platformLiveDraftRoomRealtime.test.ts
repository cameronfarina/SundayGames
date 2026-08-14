import { describe, expect, it } from "vitest";
import {
  LiveDraftRoomRevisionNotifier,
  LiveDraftRoomWaitLimitError,
} from "../src/platform/liveDraftRoomRealtime.js";

describe("live draft room revision notifier", () => {
  it("holds connection capacity for a subscription lifetime and releases its active waiter on close", async () => {
    const notifier = new LiveDraftRoomRevisionNotifier({
      maxConcurrentWaitersPerAccount: 1,
      maxConcurrentWaiters: 1,
      retryAfterSeconds: 3,
    });
    const subscription = notifier.subscribe({
      accountId: "account_cam",
      roomId: "room_sunday",
    });
    const wait = subscription.waitForRevision({ afterRevision: 1, timeoutMs: 1_000 });

    expect(() => notifier.subscribe({
      accountId: "account_cam",
      roomId: "room_sunday",
    })).toThrowError(new LiveDraftRoomWaitLimitError("account", 3));

    subscription.close();
    await expect(wait).resolves.toBe(false);

    const replacement = notifier.subscribe({
      accountId: "account_cam",
      roomId: "room_sunday",
    });
    replacement.close();
  });

  it("does not miss a revision published before a reconnect waiter is registered", async () => {
    const notifier = new LiveDraftRoomRevisionNotifier();

    notifier.notifyRevision("room_sunday", 5);

    await expect(notifier.waitForRevision({
      accountId: "account_cam",
      roomId: "room_sunday",
      afterRevision: 4,
      timeoutMs: 10,
    })).resolves.toBe(true);
    await expect(notifier.waitForRevision({
      accountId: "account_cam",
      roomId: "room_sunday",
      afterRevision: 5,
      timeoutMs: 1,
    })).resolves.toBe(false);
  });

  it("releases an account waiter immediately when its request aborts", async () => {
    const notifier = new LiveDraftRoomRevisionNotifier({
      maxConcurrentWaitersPerAccount: 1,
      maxConcurrentWaiters: 2,
      retryAfterSeconds: 3,
    });
    const disconnected = new AbortController();
    const firstWait = notifier.waitForRevision({
      accountId: "account_cam",
      roomId: "room_sunday",
      afterRevision: 1,
      timeoutMs: 1_000,
      signal: disconnected.signal,
    });

    await expect(notifier.waitForRevision({
      accountId: "account_cam",
      roomId: "room_sunday",
      afterRevision: 1,
      timeoutMs: 1_000,
    })).rejects.toEqual(new LiveDraftRoomWaitLimitError("account", 3));

    disconnected.abort();
    await expect(firstWait).resolves.toBe(false);

    const replacementWait = notifier.waitForRevision({
      accountId: "account_cam",
      roomId: "room_sunday",
      afterRevision: 1,
      timeoutMs: 1_000,
    });
    notifier.notifyRevision("room_sunday", 2);

    await expect(replacementWait).resolves.toBe(true);
  });

  it("bounds global waiters and recovers capacity after a waiter completes", async () => {
    const notifier = new LiveDraftRoomRevisionNotifier({
      maxConcurrentWaitersPerAccount: 2,
      maxConcurrentWaiters: 2,
      retryAfterSeconds: 4,
    });
    const firstWait = notifier.waitForRevision({
      accountId: "account_cam",
      roomId: "room_sunday",
      afterRevision: 1,
      timeoutMs: 1_000,
    });
    const secondWait = notifier.waitForRevision({
      accountId: "account_seth",
      roomId: "room_sunday",
      afterRevision: 1,
      timeoutMs: 1_000,
    });

    await expect(notifier.waitForRevision({
      accountId: "account_hoody",
      roomId: "room_sunday",
      afterRevision: 1,
      timeoutMs: 1_000,
    })).rejects.toEqual(new LiveDraftRoomWaitLimitError("global", 4));

    notifier.notifyRevision("room_sunday", 2);
    await expect(Promise.all([firstWait, secondWait])).resolves.toEqual([true, true]);

    const recoveredWait = notifier.waitForRevision({
      accountId: "account_hoody",
      roomId: "room_sunday",
      afterRevision: 2,
      timeoutMs: 1_000,
    });
    notifier.notifyRevision("room_sunday", 3);

    await expect(recoveredWait).resolves.toBe(true);
  });
});
