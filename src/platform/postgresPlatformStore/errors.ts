export type PostgresPlatformStoreErrorCode = "snapshot_write_conflict";

export class PostgresPlatformStoreError extends Error {
  constructor(
    readonly code: PostgresPlatformStoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PostgresPlatformStoreError";
  }
}
