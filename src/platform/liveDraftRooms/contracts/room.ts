import type { AuctionLeagueSeason } from "../../leagueSeason.js";
import type {
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomStatus,
} from "./core.js";
import type { LiveDraftRoomEvent } from "./events.js";
import type { LiveDraftRoomBoardPlayer, LiveDraftRoomProjection } from "./players.js";

export interface LiveDraftRoom {
  roomId: string;
  leagueId: string;
  seasonId: string;
  status: LiveDraftRoomStatus;
  commissionerUserId: string;
  startsAt?: Date | undefined;
  viewerPasswordHashRef: string;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  endedAt?: Date | undefined;
  season: AuctionLeagueSeason;
  playerCatalog: readonly LiveDraftRoomBoardPlayer[];
  initialRosters: readonly LiveDraftRoomInitialRosterPlayer[];
  events: readonly LiveDraftRoomEvent[];
  projection: LiveDraftRoomProjection;
}

export type LiveDraftRoomSummary = Pick<
  LiveDraftRoom,
  "roomId" | "leagueId" | "seasonId" | "status" | "startsAt" | "createdAt"
>;
