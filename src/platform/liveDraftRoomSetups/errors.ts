export class LiveDraftRoomSetupWriteConflictError extends Error {
  constructor() {
    super("Draft setup changed while this update was being saved. Reload and try again.");
    this.name = "LiveDraftRoomSetupWriteConflictError";
  }
}
