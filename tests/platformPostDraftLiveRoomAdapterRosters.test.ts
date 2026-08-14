import { describe, expect, it } from "vitest";
import { analyzeEndedLiveDraftRoomTeam } from "../src/platform/postDraftLiveRoomAdapter.js";
import type { PostDraftProjection } from "../src/platform/postDraftTeamAnalysis.js";
import { now, ownership, projectionSnapshot } from "./postDraftLiveRoomAdapter/projectionFixture.js";
import { endedRoom } from "./postDraftLiveRoomAdapter/roomFixture.js";

describe("post-draft live room roster snapshots", () => {
  it("uses a stable draft identity when a same-name projection has the wrong position", () => {
    const room = endedRoom();
    const snapshot = projectionSnapshot(room);
    const projections = snapshot.projections.map((projection): PostDraftProjection =>
      projection.playerId === "player_achane"
        ? { ...projection, position: "WR" }
        : projection
    );

    const result = analyzeEndedLiveDraftRoomTeam({
      room,
      ownership,
      projectionSnapshot: { ...snapshot, projections },
      evaluatedAt: now,
      currentWeek: 1,
    });

    expect(result.roster.players[1]).toEqual({
      playerId: "draft-player:devon achane",
      playerName: "De'Von Achane",
      position: "RB",
    });
  });

  it("builds pickup advice from catalog players who were not drafted", () => {
    const room = endedRoom();
    room.endedAt = new Date("2026-09-08T11:55:00.000Z");
    room.updatedAt = room.endedAt;
    room.playerCatalog = [
      ...room.playerCatalog,
      {
        name: "Available Running Back",
        normalizedPlayerName: "available running back",
        position: "RB",
        expectedPrice: 1,
      },
    ];
    const snapshot = projectionSnapshot(room);
    snapshot.projections = [
      ...snapshot.projections,
      {
        playerId: "player_available_rb",
        playerName: "Available Running Back",
        position: "RB",
        seasonProjectedPoints: 300,
        weeklyProjectedPoints: 30,
      },
    ];

    const result = analyzeEndedLiveDraftRoomTeam({
      room,
      ownership,
      projectionSnapshot: snapshot,
      evaluatedAt: now,
      currentWeek: 1,
    });

    expect(result.analysis.recommendations.pickupDrop.records[0]).toMatchObject({
      add: { playerId: "player_available_rb", playerName: "Available Running Back" },
      drop: { playerId: "player_achane", playerName: "De'Von Achane" },
      projectedPointGain: 13,
    });
  });
});
