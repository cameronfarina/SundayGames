export type SeasonKeeperSetupErrorCode =
  | "keeper_budget_exceeded"
  | "keeper_player_conflict"
  | "keeper_position_limit"
  | "keeper_roster_full"
  | "keeper_season_mismatch"
  | "keeper_snake_pick_conflict"
  | "keeper_snake_round_invalid"
  | "keeper_team_missing"
  | "keeper_value_invalid";

export class SeasonKeeperSetupError extends Error {
  constructor(
    readonly code: SeasonKeeperSetupErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SeasonKeeperSetupError";
  }
}
