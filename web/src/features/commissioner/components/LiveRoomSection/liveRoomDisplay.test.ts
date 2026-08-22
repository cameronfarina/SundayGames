import { afterEach, describe, expect, it, vi } from "vitest";
import { draftDetailsLabel, roomStatusLabel } from "./liveRoomDisplay";

describe("live room display", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("labels room states", () => {
    expect(roomStatusLabel(null, false)).toBe("Setup in progress");
    expect(roomStatusLabel({ roomId: "room-1", status: "countdown" }, true)).toBe("Scheduled");
    expect(roomStatusLabel({ roomId: "room-1", status: "live" }, true)).toBe("Live");
    expect(roomStatusLabel({ roomId: "room-1", status: "paused" }, true)).toBe("Paused");
    expect(roomStatusLabel({ roomId: "room-1", status: "ended" }, true)).toBe("Draft ended");
  });

  it("prefers active status and distinguishes future from past schedules", () => {
    const future = "2026-08-30T18:00:00.000Z";
    const past = "2026-08-20T18:00:00.000Z";
    const now = Date.parse("2026-08-21T12:00:00.000Z");

    expect(draftDetailsLabel(null, undefined, now)).toBe("Draft status:");
    expect(draftDetailsLabel(null, future, now)).toBe("Upcoming draft:");
    expect(draftDetailsLabel(null, past, now)).toBe("Draft scheduled for:");
    expect(draftDetailsLabel({ roomId: "room-1", status: "live" }, future, now))
      .toBe("Draft status:");
    expect(draftDetailsLabel({ roomId: "room-1", status: "paused" }, future, now))
      .toBe("Draft status:");
    expect(draftDetailsLabel({ roomId: "room-1", status: "ended" }, future, now))
      .toBe("Draft status:");
  });
});
