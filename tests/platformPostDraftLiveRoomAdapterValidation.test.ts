import { describe, expect, it } from "vitest";
import {
  analyzeEndedLiveDraftRoomTeam,
  PostDraftLiveRoomAdapterError,
} from "../src/platform/postDraftLiveRoomAdapter.js";
import { now, ownership, projectionSnapshot } from "./postDraftLiveRoomAdapter/projectionFixture.js";
import { endedRoom } from "./postDraftLiveRoomAdapter/roomFixture.js";

const analyze = (room: ReturnType<typeof endedRoom>, owned = ownership): void => {
  analyzeEndedLiveDraftRoomTeam({
    room,
    ownership: owned,
    projectionSnapshot: projectionSnapshot(room),
    evaluatedAt: now,
    currentWeek: 1,
  });
};

describe("post-draft live room adapter validation", () => {
  it("rejects a room that has not ended", () => {
    const room = endedRoom();
    room.status = "live";
    room.projection.status = "live";

    expect(() => analyze(room)).toThrow(new PostDraftLiveRoomAdapterError(
      "room_not_ended",
      "My Team analysis is available only after the live draft room has ended.",
    ));
  });

  it("rejects analysis requested for another private owner", () => {
    const room = endedRoom();
    expect(() => analyze(room, {
      ...ownership,
      privateOwnerUserId: "user_someone_else",
    })).toThrow(new PostDraftLiveRoomAdapterError(
      "private_owner_mismatch",
      "My Team analysis must be private to the requesting user.",
    ));
  });

  it("rejects a claimed team outside the private room context", () => {
    const room = endedRoom();
    expect(() => analyze(room, {
      ...ownership,
      teamId: "team_not_claimed",
    })).toThrow(new PostDraftLiveRoomAdapterError(
      "owned_team_mismatch",
      "Claimed team team_not_claimed is not owned by owner_cam in this live draft room.",
    ));
  });

  it("rejects a claimed owner that does not own the selected team", () => {
    const room = endedRoom();
    expect(() => analyze(room, {
      ...ownership,
      ownerId: "owner_someone_else",
    })).toThrow(new PostDraftLiveRoomAdapterError(
      "owned_team_mismatch",
      "Claimed team team_cam is not owned by owner_someone_else in this live draft room.",
    ));
  });

  it("rejects projection data from a different league context", () => {
    const room = endedRoom();
    const projections = projectionSnapshot(room);

    expect(() => analyzeEndedLiveDraftRoomTeam({
      room,
      ownership,
      projectionSnapshot: {
        ...projections,
        metadata: { ...projections.metadata, leagueId: "league_other" },
      },
      evaluatedAt: now,
      currentWeek: 1,
    })).toThrow(new PostDraftLiveRoomAdapterError(
      "context_mismatch",
      "Projection snapshot does not match the live draft room league and season.",
    ));
  });

  it("rejects an unsupported active lineup slot", () => {
    const room = endedRoom();
    room.season.settings.roster.lineup.ESPN_SLOT_99 = 1;

    expect(() => analyze(room)).toThrow(new PostDraftLiveRoomAdapterError(
      "context_mismatch",
      "Live draft room uses unsupported starter slot ESPN_SLOT_99.",
    ));
  });
});
