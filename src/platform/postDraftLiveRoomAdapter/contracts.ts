import type { LiveDraftRoom } from "../liveDraftRooms.js";
import type {
  MyTeamOwnershipContext,
  PostDraftProjectionSnapshot,
  PostDraftTeamAnalysis,
  PostDraftTeamRoster,
} from "../postDraftTeamAnalysis.js";

export interface AnalyzeEndedLiveDraftRoomTeamInput {
  room: LiveDraftRoom;
  ownership: MyTeamOwnershipContext;
  projectionSnapshot: PostDraftProjectionSnapshot;
  evaluatedAt: Date;
  currentWeek: number;
}

export interface PrivatePostDraftTeamResult {
  roster: PostDraftTeamRoster;
  analysis: PostDraftTeamAnalysis;
}
