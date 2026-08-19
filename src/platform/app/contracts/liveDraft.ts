import type {
  CreateLiveDraftRoomInput,
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomPickCommandInput,
  LiveDraftRoomPlayerCatalogEntry,
  LiveDraftRoomSaleCommandInput,
} from "../../liveDraftRooms.js";

export interface CreatePlatformLiveDraftRoomInput extends Omit<
  CreateLiveDraftRoomInput,
  "season" | "commissionerUserId" | "createdAt"
> {
  actorSessionToken: string;
  seasonId: string;
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[];
  initialRosters?: readonly LiveDraftRoomInitialRosterPlayer[] | undefined;
  now?: Date | undefined;
}

export interface GetPlatformLiveDraftRoomInput {
  actorSessionToken: string;
  roomId: string;
  selectedTeamId?: string | undefined;
  viewedTeamId?: string | undefined;
  now?: Date | undefined;
}

export interface SynchronizePlatformLiveDraftRoomInitialRostersInput {
  actorSessionToken: string;
  seasonId: string;
  initialRosters: readonly LiveDraftRoomInitialRosterPlayer[];
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[];
  expectedRevision?: number | undefined;
  idempotencyKey: string;
  now?: Date | undefined;
}

export interface GetPlatformLiveDraftRoomEventsInput extends GetPlatformLiveDraftRoomInput {
  afterRevision: number;
}

export interface MutatePlatformLiveDraftRoomInput {
  actorSessionToken: string;
  roomId: string;
  expectedRevision?: number | undefined;
  idempotencyKey?: string | undefined;
  now?: Date | undefined;
}

export interface EndPlatformLiveDraftRoomInput extends MutatePlatformLiveDraftRoomInput {
  allowIncomplete?: boolean | undefined;
}

export interface LogPlatformLiveDraftSaleInput extends MutatePlatformLiveDraftRoomInput {
  sale: LiveDraftRoomSaleCommandInput;
}

export interface CorrectPlatformLiveDraftSaleInput extends MutatePlatformLiveDraftRoomInput {
  saleEventId: string;
  replacementSale: LiveDraftRoomSaleCommandInput;
}

export interface LogPlatformLiveDraftPickInput extends MutatePlatformLiveDraftRoomInput {
  pick: LiveDraftRoomPickCommandInput;
}

export interface CorrectPlatformLiveDraftPickInput extends MutatePlatformLiveDraftRoomInput {
  pickEventId: string;
  replacementPick: LiveDraftRoomPickCommandInput;
}

export interface ExportPlatformLiveDraftRoomInput {
  actorSessionToken: string;
  roomId: string;
  exportedAt: Date;
  now?: Date | undefined;
}

export interface CreatePlatformLiveDraftExportArtifactInput extends ExportPlatformLiveDraftRoomInput {}
