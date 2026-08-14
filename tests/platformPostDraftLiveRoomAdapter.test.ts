import { describe, expect, it } from "vitest";
import { analyzeEndedLiveDraftRoomTeam } from "../src/platform/postDraftLiveRoomAdapter.js";
import { now, ownership, projectionSnapshot } from "./postDraftLiveRoomAdapter/projectionFixture.js";
import { endedRoom } from "./postDraftLiveRoomAdapter/roomFixture.js";

describe("post-draft live room adapter", () => {
  it("returns only the claimed roster and its private analysis from an ended room", () => {
    const room = endedRoom();
    const result = analyzeEndedLiveDraftRoomTeam({
      room,
      ownership,
      projectionSnapshot: projectionSnapshot(room),
      evaluatedAt: now,
      currentWeek: 1,
    });

    expect(result.roster).toEqual({
      teamId: "team_cam",
      ownerId: "owner_cam",
      players: [
        { playerId: "player_cam_qb", playerName: "Owner11 Quarterback", position: "QB" },
        { playerId: "player_achane", playerName: "De'Von Achane", position: "RB" },
      ],
    });
    expect(result.analysis.ownership).toEqual(ownership);
    expect(result.analysis.ranking).toMatchObject({ status: "available", rank: 1, teamCount: 4 });
    expect(result.analysis.recommendationReadiness.startSit.status).toBe("stale");
    expect(result).not.toHaveProperty("completedDraftRoster");
  });

  it("keeps the ended-room roster current long enough for immediate coach advice", () => {
    const room = endedRoom();
    room.endedAt = new Date("2026-09-08T11:55:00.000Z");
    room.updatedAt = room.endedAt;

    const result = analyzeEndedLiveDraftRoomTeam({
      room,
      ownership,
      projectionSnapshot: projectionSnapshot(room),
      evaluatedAt: now,
      currentWeek: 1,
    });

    expect(result.analysis.recommendationReadiness.startSit.status).toBe("ready");
    expect(result.analysis.recommendationReadiness.pickupDrop.status).toBe("ready");
  });

  it("marks rankings unavailable when projection coverage is incomplete", () => {
    const room = endedRoom();
    const projections = projectionSnapshot(room);
    const result = analyzeEndedLiveDraftRoomTeam({
      room,
      ownership,
      projectionSnapshot: {
        ...projections,
        projections: projections.projections.filter(
          projection => projection.playerId !== "player_sam_rb",
        ),
      },
      evaluatedAt: now,
      currentWeek: 1,
    });

    expect(result.roster.teamId).toBe("team_cam");
    expect(result.analysis.ranking).toMatchObject({
      status: "unavailable",
      reasons: [expect.objectContaining({ code: "projection_coverage_incomplete" })],
    });
  });

  it("uses the room update time and ignores non-starter lineup entries", () => {
    const room = endedRoom();
    room.endedAt = undefined;
    room.updatedAt = new Date("2026-09-08T11:55:00.000Z");
    room.season.settings.roster.lineup = {
      QB: 2,
      RB: 1,
      FLEX: 0,
      BENCH: 7,
      IR: 1,
    };

    const result = analyzeEndedLiveDraftRoomTeam({
      room,
      ownership,
      projectionSnapshot: projectionSnapshot(room),
      evaluatedAt: now,
      currentWeek: 1,
    });

    expect(result.roster.teamId).toBe("team_cam");
    expect(result.analysis.recommendationReadiness.pickupDrop.status).toBe("ready");
    expect(result.analysis.ranking.status).toBe("unavailable");
  });
});
