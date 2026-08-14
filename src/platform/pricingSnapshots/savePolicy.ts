import type {
  PricingSnapshot,
  PricingSnapshotRepository,
} from "./contracts.js";
import { PricingSnapshotError } from "./errors.js";
import { snapshotPayloadHash } from "./snapshotPayload.js";

export const assertPricingSnapshotCanBeSaved = (
  repository: PricingSnapshotRepository,
  snapshot: PricingSnapshot,
): void => {
  const existing = repository.get(snapshot.modelRunId, snapshot.scenarioId);
  if (
    existing !== undefined
    && snapshotPayloadHash(existing) !== snapshotPayloadHash(snapshot)
  ) {
    throw new PricingSnapshotError(
      "pricing_snapshot_conflict",
      `Cannot overwrite pricing snapshot for modelRunId ${snapshot.modelRunId} and scenarioId ${snapshot.scenarioId} with a different payload.`,
    );
  }
};
