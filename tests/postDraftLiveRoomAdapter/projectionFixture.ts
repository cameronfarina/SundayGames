import type { LiveDraftRoom } from "../../src/platform/liveDraftRooms.js";
import { postDraftScoringSettingsIdForSeason } from "../../src/platform/postDraftLiveRoomAdapter.js";
import type {
  MyTeamOwnershipContext,
  PostDraftProjectionSnapshot,
} from "../../src/platform/postDraftTeamAnalysis.js";
import { leagueId, seasonId } from "./seasonFixture.js";

export const now = new Date("2026-09-08T12:00:00.000Z");

export const ownership: MyTeamOwnershipContext = {
  userId: "user_cam",
  privateOwnerUserId: "user_cam",
  leagueId,
  seasonId,
  teamId: "team_cam",
  ownerId: "owner_cam",
};

export const projectionSnapshot = (room: LiveDraftRoom): PostDraftProjectionSnapshot => ({
  metadata: {
    snapshotId: "current-projections-2026-week-1",
    leagueId,
    seasonId,
    scoringSettingsId: postDraftScoringSettingsIdForSeason(room.season),
    generatedAt: "2026-09-08T11:30:00.000Z",
    validThrough: "2026-09-08T18:00:00.000Z",
    week: 1,
  },
  projections: [
    {
      playerId: "player_cam_qb",
      playerName: "Owner11 Quarterback",
      position: "QB",
      seasonProjectedPoints: 300,
      weeklyProjectedPoints: 20,
    },
    {
      playerId: "player_achane",
      playerName: "Devon Achane",
      position: "RB",
      seasonProjectedPoints: 250,
      weeklyProjectedPoints: 17,
    },
    {
      playerId: "player_sam_qb",
      playerName: "Owner12 Quarterback",
      position: "QB",
      seasonProjectedPoints: 100,
      weeklyProjectedPoints: 8,
    },
    {
      playerId: "player_sam_rb",
      playerName: "Owner12 Running Back",
      position: "RB",
      seasonProjectedPoints: 80,
      weeklyProjectedPoints: 6,
    },
    {
      playerId: "player_nick_qb",
      playerName: "Nick Quarterback",
      position: "QB",
      seasonProjectedPoints: 90,
      weeklyProjectedPoints: 7,
    },
    {
      playerId: "player_nick_rb",
      playerName: "Nick Running Back",
      position: "RB",
      seasonProjectedPoints: 70,
      weeklyProjectedPoints: 5,
    },
    {
      playerId: "player_seth_qb",
      playerName: "Owner04 Quarterback",
      position: "QB",
      seasonProjectedPoints: 80,
      weeklyProjectedPoints: 6,
    },
    {
      playerId: "player_seth_rb",
      playerName: "Owner04 Running Back",
      position: "RB",
      seasonProjectedPoints: 60,
      weeklyProjectedPoints: 4,
    },
  ],
});
