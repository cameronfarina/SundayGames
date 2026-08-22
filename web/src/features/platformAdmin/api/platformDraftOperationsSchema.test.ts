import { describe, expect, it } from "vitest";
import { platformDraftScheduleSchema } from "./platformDraftOperationsSchema";

const fixture = {
  generatedAt: "2026-08-22T12:00:00.000Z",
  timezone: "America/New_York",
  today: [{
    draftFormat: "auction",
    endedAt: null,
    leagueId: "league-1",
    leagueName: "Sunday Games",
    readiness: "room_ready",
    roomId: "room-1",
    roomStatus: "setup",
    seasonId: "season-1",
    seasonName: "2026 season",
    seasonYear: 2026,
    startedAt: null,
    startsAt: "2026-08-22T23:00:00.000Z",
    teamCount: 12,
  }],
  upcoming: [],
  summary: {
    estimatedDraftDurationMinutes: 180,
    liveNow: 0,
    peakConcurrentDrafts: 1,
    peakWindow: {
      endsAt: "2026-08-23T02:00:00.000Z",
      startsAt: "2026-08-22T23:00:00.000Z",
    },
    roomsNotCreated: 0,
    scheduledToday: 1,
    scheduledUpcoming: 0,
  },
};

describe("platformDraftScheduleSchema", () => {
  it("accepts creator operations schedule responses", () => {
    expect(platformDraftScheduleSchema.parse(fixture)).toEqual(fixture);
  });

  it("rejects unknown room readiness states", () => {
    expect(() => platformDraftScheduleSchema.parse({
      ...fixture,
      today: [{ ...fixture.today[0], readiness: "league_admin" }],
    })).toThrow();
  });
});
