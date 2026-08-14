export type DraftExportRosterSlotKey =
  | "QB"
  | "RB1"
  | "RB2"
  | "WR1"
  | "WR2"
  | "TE"
  | "FLEX"
  | "K"
  | "DST"
  | "BENCH1"
  | "BENCH2"
  | "BENCH3"
  | "BENCH4"
  | "BENCH5"
  | "BENCH6"
  | "BENCH7";

export type DraftExportPlayerSource = "keeper" | "auction";
export type DraftExportCell = string | number;
export type DraftExportErrorCode = "duplicate_player" | "invalid_price" | "invalid_slot";

export interface DraftExportRosterPlayer {
  name: string;
  price: number;
  source?: DraftExportPlayerSource;
}

export interface DraftExportRosterSlot {
  slot: DraftExportRosterSlotKey;
  player?: DraftExportRosterPlayer;
}

export interface DraftExportTeamState {
  teamId: string;
  teamName: string;
  ownerName: string;
  draftOrderPosition?: number;
  slots: readonly DraftExportRosterSlot[];
}

export interface GenerateDraftExportInput {
  leagueName: string;
  seasonYear: number;
  draftRoomId: string;
  exportedAt: Date | string;
  status: string;
  revision: number;
  teams: readonly DraftExportTeamState[];
}

export interface DraftExportResult {
  sheetName: "Draft Results";
  table: DraftExportCell[][];
  csv: string;
}
