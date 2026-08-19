import type { Position } from "../../../../config/league.js";
import type { SeasonProjectionScoring } from "../../../modeling/seasonLongProjection.js";
import type { WorkspaceRole } from "../../workspacePrivacy.js";

export type LiveDraftRoomStatus = "setup" | "countdown" | "live" | "paused" | "ended";

export interface LiveDraftRoomPlayerCatalogEntry {
  name: string;
  position: Position;
  expectedPrice: number;
  marketPrice?: number | undefined;
  teamAbbreviation?: string | undefined;
  byeWeek?: number | undefined;
  week1Projection?: number | undefined;
  weeks1To4Projection?: number | undefined;
  seasonProjection?: number | undefined;
  seasonProjectionAdjustmentFactor?: number | undefined;
  seasonProjectionScoring?: SeasonProjectionScoring | undefined;
}

export interface LiveDraftRoomInitialRosterPlayer {
  teamId: string;
  playerId?: string | undefined;
  playerName: string;
  position: Position;
  price: number;
  keeperRound?: number | undefined;
  expectedPrice?: number | undefined;
  source?: "keeper" | "imported" | undefined;
}

export interface LiveDraftRoomActor {
  userId: string;
  leagueId: string;
  role?: WorkspaceRole | undefined;
  /** The team this member manages, when they have claimed one. */
  teamId?: string | undefined;
}

export type LiveDraftRoomMutationAction =
  | "read"
  | "cancel"
  | "sync_initial_rosters"
  | "start"
  | "pause"
  | "resume"
  | "reopen"
  | "log_sale"
  | "correct_sale"
  | "undo_sale"
  | "end";
