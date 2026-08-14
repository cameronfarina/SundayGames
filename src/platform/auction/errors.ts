export type GenericAuctionMockErrorCode =
  | "draft_incomplete"
  | "duplicate_player"
  | "invalid_config"
  | "invalid_decision"
  | "invalid_keeper"
  | "invalid_price"
  | "invalid_status"
  | "max_bid_exceeded"
  | "no_decision_to_undo"
  | "no_eligible_player"
  | "player_not_found"
  | "position_limit"
  | "roster_full"
  | "roster_limit"
  | "stale_revision"
  | "team_not_found";

export class GenericAuctionMockError extends Error {
  readonly code: GenericAuctionMockErrorCode;

  constructor(code: GenericAuctionMockErrorCode, message: string) {
    super(message);
    this.name = "GenericAuctionMockError";
    this.code = code;
  }
}
