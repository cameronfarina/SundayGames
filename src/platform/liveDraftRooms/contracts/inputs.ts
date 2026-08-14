import type { LeagueSeason } from "../../leagueSeason.js";
import type {
  LiveDraftRoomActor,
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomPlayerCatalogEntry,
} from "./core.js";
import type { LiveDraftRoomSaleCommandInput } from "./players.js";

export interface CreateLiveDraftRoomInput {
  season: LeagueSeason;
  roomId: string;
  commissionerUserId: string;
  viewerPasswordHashRef: string;
  startsAt?: Date | undefined;
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[];
  initialRosters?: readonly LiveDraftRoomInitialRosterPlayer[] | undefined;
  createdAt?: Date | undefined;
}

export interface MutateLiveDraftRoomInput {
  roomId: string;
  actor: LiveDraftRoomActor;
  expectedRevision?: number | undefined;
  idempotencyKey?: string | undefined;
  now?: Date | undefined;
}

export interface SynchronizeLiveDraftRoomInitialRostersInput {
  seasonId: string;
  actor: LiveDraftRoomActor;
  initialRosters: readonly LiveDraftRoomInitialRosterPlayer[];
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[];
  expectedRevision?: number | undefined;
  idempotencyKey: string;
  now?: Date | undefined;
}

export interface EndLiveDraftRoomInput extends MutateLiveDraftRoomInput {
  allowIncomplete?: boolean | undefined;
}

export interface LogLiveDraftRoomSaleInput extends MutateLiveDraftRoomInput {
  sale: LiveDraftRoomSaleCommandInput;
}

export interface CorrectLiveDraftRoomSaleInput extends MutateLiveDraftRoomInput {
  saleEventId: string;
  replacementSale: LiveDraftRoomSaleCommandInput;
}
