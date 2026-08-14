export type SeasonSnakeMockErrorCode =
  | "human_team_missing"
  | "invalid_command_log"
  | "keeper_round_missing"
  | "setup_mismatch"
  | "wrong_draft_format";

export class SeasonSnakeMockError extends Error {
  constructor(
    readonly code: SeasonSnakeMockErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SeasonSnakeMockError";
  }
}

export const invalidSnakeCommand = (): never => {
  throw new SeasonSnakeMockError("invalid_command_log", "Snake mock command log is invalid.");
};
