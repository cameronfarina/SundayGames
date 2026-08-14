export type PlatformAppErrorCode =
  | "auth_required"
  | "draft_room_not_final"
  | "historical_import_not_found"
  | "league_not_found"
  | "membership_required"
  | "private_resource"
  | "private_team_required"
  | "pricing_snapshot_not_found"
  | "season_not_found"
  | "shared_mutation_denied"
  | "team_already_claimed"
  | "team_claim_locked"
  | "team_claim_required"
  | "team_not_found";

export class PlatformAppError extends Error {
  readonly code: PlatformAppErrorCode;

  constructor(code: PlatformAppErrorCode, message: string) {
    super(message);
    this.name = "PlatformAppError";
    this.code = code;
  }
}
