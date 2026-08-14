export type SnakeDraftErrorCode =
  | "draft_incomplete"
  | "duplicate_player"
  | "invalid_config"
  | "invalid_keeper"
  | "invalid_status"
  | "no_pick_to_undo"
  | "not_human_turn"
  | "player_not_found"
  | "roster_limit"
  | "stale_revision";

export class SnakeDraftError extends Error {
  readonly code: SnakeDraftErrorCode;

  constructor(code: SnakeDraftErrorCode, message: string) {
    super(message);
    this.name = "SnakeDraftError";
    this.code = code;
  }
}
