import type {
  LiveDraftRoom,
  LiveDraftRoomActor,
  LiveDraftRoomBoardPlayer,
  LiveDraftRoomRosterPlayer,
  LiveDraftRoomRosterSlot,
  LiveDraftRoomSale,
  LiveDraftRoomStatus,
  LiveDraftRoomTeamState,
} from "../../liveDraftRooms.js";

export type LiveDraftRoomViewerRole = "commissioner" | "member" | "observer";
export type LiveDraftRoomExportReadinessStatus = "pending" | "ready" | "blocked";

export interface LiveDraftRoomStreamActor extends LiveDraftRoomActor {
  teamId?: string | undefined;
  ownerId?: string | undefined;
}

export interface BuildLiveDraftRoomReadModelInput {
  room: LiveDraftRoom;
  actor: LiveDraftRoomStreamActor;
  selectedTeamId?: string | undefined;
  viewedTeamId?: string | undefined;
}

export interface LiveDraftRoomTeamSummary {
  teamId: string;
  ownerId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
  draftOrderPosition: number;
  budgetDollars: number;
  spent: number;
  budgetRemaining: number;
  rosterSlotsRemaining: number;
  maxBid: number;
  positionCounts: LiveDraftRoomTeamState["positionCounts"];
  roster: readonly LiveDraftRoomRosterPlayer[];
  slots: readonly LiveDraftRoomRosterSlot[];
}

export interface LiveDraftRoomSaleLogEntry {
  saleEventId: string;
  revision: number;
  occurredAt: string;
  teamId: string;
  ownerId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
  playerName: string;
  position: LiveDraftRoomSale["position"];
  price: number;
  expectedPrice: number;
  teamAbbreviation?: string | undefined;
  byeWeek?: number | undefined;
}

export interface LiveDraftRoomExportReadiness {
  status: LiveDraftRoomExportReadinessStatus;
  completedRevision?: number | undefined;
  blockers: readonly string[];
}

export interface LiveDraftRoomConnectionState {
  state: "synchronized";
  transport: "sse";
  cursor: string;
  revision: number;
  retryMilliseconds: number;
  pollingFallback: true;
}

export interface LiveDraftRoomReadModel {
  roomId: string;
  leagueId: string;
  seasonId: string;
  status: LiveDraftRoomStatus;
  revision: number;
  updatedAt: string;
  role: LiveDraftRoomViewerRole;
  canMutateRoom: boolean;
  canExportDraft: boolean;
  board: readonly LiveDraftRoomBoardPlayer[];
  selectedTeam?: LiveDraftRoomTeamSummary | undefined;
  viewedTeam?: LiveDraftRoomTeamSummary | undefined;
  teamSummaries: readonly LiveDraftRoomTeamSummary[];
  salesLog: readonly LiveDraftRoomSaleLogEntry[];
  connection: LiveDraftRoomConnectionState;
  exportReadiness: LiveDraftRoomExportReadiness;
}
