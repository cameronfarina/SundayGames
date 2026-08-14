export type SeasonAuctionMockErrorCode =
  | "human_team_missing"
  | "invalid_command_log"
  | "setup_mismatch"
  | "wrong_draft_format";

export class SeasonAuctionMockError extends Error {
  constructor(
    readonly code: SeasonAuctionMockErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SeasonAuctionMockError";
  }
}

export const invalidAuctionCommand = (): never => {
  throw new SeasonAuctionMockError("invalid_command_log", "Auction mock command log is invalid.");
};
