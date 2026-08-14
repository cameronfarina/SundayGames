export type KeeperCommandDraftType = "auction" | "snake";

export interface KeeperCommandTeamCatalogEntry {
  teamId: string;
  teamName: string;
  managerNames: readonly string[];
  aliases?: readonly string[];
}

export interface KeeperCommandPlayerCatalogEntry {
  playerId: string;
  name: string;
  aliases?: readonly string[];
}

export interface ParseKeeperCommandInput {
  command: string;
  draftType: KeeperCommandDraftType;
  auctionMinimumBidDollars?: number | undefined;
  snakeRoundCount?: number | undefined;
  teams: readonly KeeperCommandTeamCatalogEntry[];
  players: readonly KeeperCommandPlayerCatalogEntry[];
}

export interface KeeperCommandPreviewTeam {
  id: string;
  name: string;
}

export interface KeeperCommandPreviewPlayer {
  id: string;
  name: string;
}

export interface KeeperCommandAuctionValuePreview {
  draftType: "auction";
  auctionCostDollars: number;
}

export interface KeeperCommandSnakeValuePreview {
  draftType: "snake";
  keeperRound: number;
}

export type KeeperCommandValuePreview =
  | KeeperCommandAuctionValuePreview
  | KeeperCommandSnakeValuePreview;

export interface KeeperCommandPreview {
  kind: "preview";
  confirmationRequired: true;
  sourceCommand: string;
  team: KeeperCommandPreviewTeam;
  player: KeeperCommandPreviewPlayer;
  keeper: KeeperCommandValuePreview;
}

export type KeeperCommandImportErrorCode =
  | "invalid_format"
  | "invalid_value"
  | "unknown_team"
  | "ambiguous_team"
  | "unknown_player"
  | "ambiguous_player";

export interface KeeperCommandImportError {
  code: KeeperCommandImportErrorCode;
  message: string;
  mention?: string;
  candidates?: readonly string[];
}

export interface KeeperCommandErrorResult {
  kind: "error";
  error: KeeperCommandImportError;
}

export type KeeperCommandImportResult = KeeperCommandPreview | KeeperCommandErrorResult;
