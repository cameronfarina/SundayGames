import { hashPricingSnapshotInputs } from "./canonicalInputs.js";
import type { PricingSnapshot } from "./contracts.js";

export const snapshotPayloadHash = (snapshot: PricingSnapshot): string => {
  const { createdAt: _createdAt, ...immutablePayload } = snapshot;
  return hashPricingSnapshotInputs(immutablePayload);
};

export const snapshotStorageKey = (modelRunId: string, scenarioId: string): string =>
  `${modelRunId}\0${scenarioId}`;
