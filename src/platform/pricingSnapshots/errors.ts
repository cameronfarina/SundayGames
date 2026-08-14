export type PricingSnapshotErrorCode = "pricing_snapshot_conflict";

export class PricingSnapshotError extends Error {
  readonly code: PricingSnapshotErrorCode;

  constructor(code: PricingSnapshotErrorCode, message: string) {
    super(message);
    this.name = "PricingSnapshotError";
    this.code = code;
  }
}
