import type { LiveDraftRoomInitialRosterPlayer } from "./core.js";
import type {
  LiveDraftRoomBoardPlayer,
  LiveDraftRoomIncompleteTeam,
  LiveDraftRoomPickSelection,
  LiveDraftRoomSale,
} from "./players.js";

interface LiveDraftRoomEventBase {
  id: string;
  roomId: string;
  leagueId: string;
  seasonId: string;
  revision: number;
  actorUserId: string;
  occurredAt: Date;
  idempotencyKey?: string | undefined;
  mutationHash?: string | undefined;
}

export interface LiveDraftRoomCreatedEvent extends LiveDraftRoomEventBase {
  type: "room_created";
}

export interface LiveDraftRoomInitialRostersSynchronizedEvent extends LiveDraftRoomEventBase {
  type: "initial_rosters_synchronized";
  idempotencyKey: string;
  mutationHash: string;
  initialRosters: readonly LiveDraftRoomInitialRosterPlayer[];
  playerCatalog: readonly LiveDraftRoomBoardPlayer[];
}

export interface LiveDraftRoomPausedEvent extends LiveDraftRoomEventBase {
  type: "room_paused";
}

export interface LiveDraftRoomResumedEvent extends LiveDraftRoomEventBase {
  type: "room_resumed";
}

export interface LiveDraftRoomStartedEvent extends LiveDraftRoomEventBase {
  type: "room_started";
}

export interface LiveDraftRoomSaleLoggedEvent extends LiveDraftRoomEventBase {
  type: "sale_logged";
  sale: LiveDraftRoomSale;
}

export interface LiveDraftRoomSaleCorrectedEvent extends LiveDraftRoomEventBase {
  type: "sale_corrected";
  correctedSaleEventId: string;
  previousSale: LiveDraftRoomSale;
  replacementSale: LiveDraftRoomSale;
}

export interface LiveDraftRoomSaleUndoneEvent extends LiveDraftRoomEventBase {
  type: "sale_undone";
  undoneSaleEventId: string;
  undoneSale: LiveDraftRoomSale;
}

export interface LiveDraftRoomPickLoggedEvent extends LiveDraftRoomEventBase {
  type: "pick_logged";
  pick: LiveDraftRoomPickSelection;
}

export interface LiveDraftRoomPickCorrectedEvent extends LiveDraftRoomEventBase {
  type: "pick_corrected";
  correctedPickEventId: string;
  previousPick: LiveDraftRoomPickSelection;
  replacementPick: LiveDraftRoomPickSelection;
}

export interface LiveDraftRoomPickUndoneEvent extends LiveDraftRoomEventBase {
  type: "pick_undone";
  undonePickEventId: string;
  undonePick: LiveDraftRoomPickSelection;
}

export interface LiveDraftRoomEndedEvent extends LiveDraftRoomEventBase {
  type: "room_ended";
  incomplete: boolean;
  incompleteTeams: readonly LiveDraftRoomIncompleteTeam[];
}

export interface LiveDraftRoomReopenedEvent extends LiveDraftRoomEventBase {
  type: "room_reopened";
}

export type LiveDraftRoomEvent =
  | LiveDraftRoomCreatedEvent
  | LiveDraftRoomInitialRostersSynchronizedEvent
  | LiveDraftRoomPausedEvent
  | LiveDraftRoomResumedEvent
  | LiveDraftRoomStartedEvent
  | LiveDraftRoomSaleLoggedEvent
  | LiveDraftRoomSaleCorrectedEvent
  | LiveDraftRoomSaleUndoneEvent
  | LiveDraftRoomPickLoggedEvent
  | LiveDraftRoomPickCorrectedEvent
  | LiveDraftRoomPickUndoneEvent
  | LiveDraftRoomEndedEvent
  | LiveDraftRoomReopenedEvent;
