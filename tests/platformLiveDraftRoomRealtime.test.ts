import { describe, expect, it } from "vitest";
import { LiveDraftRoomRevisionNotifier } from "../src/platform/liveDraftRoomRealtime.js";

describe("live draft room revision notifier", () => {
  it("does not miss a revision published before a reconnect waiter is registered", async () => {
    const notifier = new LiveDraftRoomRevisionNotifier();

    notifier.notifyRevision("room_sunday", 5);

    await expect(notifier.waitForRevision({
      roomId: "room_sunday",
      afterRevision: 4,
      timeoutMs: 10,
    })).resolves.toBe(true);
    await expect(notifier.waitForRevision({
      roomId: "room_sunday",
      afterRevision: 5,
      timeoutMs: 1,
    })).resolves.toBe(false);
  });
});
