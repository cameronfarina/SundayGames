export type PostDraftTeamAnalysisErrorCode =
  | "owned_team_mismatch"
  | "owned_team_missing"
  | "private_owner_mismatch"
  | "snapshot_context_mismatch";

export class PostDraftTeamAnalysisError extends Error {
  constructor(
    readonly code: PostDraftTeamAnalysisErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PostDraftTeamAnalysisError";
  }
}
