import { describe, expect, it } from "vitest";
import {
  analyzeEndedLiveDraftRoomTeam,
  PostDraftLiveRoomAdapterError,
} from "../src/platform/postDraftLiveRoomAdapter.js";
import { now, ownership, projectionSnapshot } from "./postDraftLiveRoomAdapter/projectionFixture.js";
import { endedRoom } from "./postDraftLiveRoomAdapter/roomFixture.js";

describe("post-draft live room context validation", () => {
  it("rejects an internally inconsistent room projection", () => {
    const room = endedRoom();
    room.projection.roomId = "room_other";

    expect(() => analyzeEndedLiveDraftRoomTeam({
      room,
      ownership,
      projectionSnapshot: projectionSnapshot(room),
      evaluatedAt: now,
      currentWeek: 1,
    })).toThrow(new PostDraftLiveRoomAdapterError(
      "context_mismatch",
      "Live draft room context is internally inconsistent.",
    ));
  });

  it("rejects ownership from another season", () => {
    const room = endedRoom();
    expect(() => analyzeEndedLiveDraftRoomTeam({
      room,
      ownership: { ...ownership, seasonId: "season_other" },
      projectionSnapshot: projectionSnapshot(room),
      evaluatedAt: now,
      currentWeek: 1,
    })).toThrow(new PostDraftLiveRoomAdapterError(
      "context_mismatch",
      "Claimed ownership does not match the live draft room league and season.",
    ));
  });

  it("rejects a projection scored with different settings", () => {
    const room = endedRoom();
    const snapshot = projectionSnapshot(room);
    expect(() => analyzeEndedLiveDraftRoomTeam({
      room,
      ownership,
      projectionSnapshot: {
        ...snapshot,
        metadata: { ...snapshot.metadata, scoringSettingsId: "different-scoring" },
      },
      evaluatedAt: now,
      currentWeek: 1,
    })).toThrow(new PostDraftLiveRoomAdapterError(
      "context_mismatch",
      "Projection snapshot scoring does not match the live draft room settings.",
    ));
  });

  it("rejects negative and fractional lineup slot counts", () => {
    for (const invalidCount of [-1, 1.5]) {
      const room = endedRoom();
      room.season.settings.roster.lineup.QB = invalidCount;
      expect(() => analyzeEndedLiveDraftRoomTeam({
        room,
        ownership,
        projectionSnapshot: projectionSnapshot(room),
        evaluatedAt: now,
        currentWeek: 1,
      })).toThrow(new PostDraftLiveRoomAdapterError(
        "context_mismatch",
        "Live draft room has an invalid count for lineup slot QB.",
      ));
    }
  });
});
