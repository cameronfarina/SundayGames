export type PostDraftLiveRoomAdapterErrorCode =
  | "context_mismatch"
  | "owned_team_mismatch"
  | "private_owner_mismatch"
  | "projection_coverage_incomplete"
  | "room_not_ended";

export class PostDraftLiveRoomAdapterError extends Error {
  constructor(
    readonly code: PostDraftLiveRoomAdapterErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PostDraftLiveRoomAdapterError";
  }
}
