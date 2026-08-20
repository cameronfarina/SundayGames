export type LiveDraftRoomErrorCode =
  | "access_denied"
  | "draft_complete"
  | "draft_incomplete"
  | "duplicate_player"
  | "expected_revision_required"
  | "idempotency_conflict"
  | "idempotency_key_required"
  | "invalid_sale_price"
  | "max_bid_exceeded"
  | "mutation_denied"
  | "no_sale_to_undo"
  | "out_of_turn"
  | "owner_not_found"
  | "player_not_found"
  | "position_limit"
  | "room_not_found"
  | "room_not_cancellable"
  | "room_not_live"
  | "room_not_paused"
  | "room_not_reopenable"
  | "room_paused"
  | "room_already_exists"
  | "room_already_ended"
  | "room_already_live"
  | "roster_full"
  | "sale_not_active"
  | "season_not_ready"
  | "stale_revision"
  | "team_not_found";

export class LiveDraftRoomError extends Error {
  readonly code: LiveDraftRoomErrorCode;

  constructor(code: LiveDraftRoomErrorCode, message: string) {
    super(message);
    this.name = "LiveDraftRoomError";
    this.code = code;
  }
}
