import type {
  PricingSnapshot,
  PricingSnapshotRepository,
} from "./contracts.js";
import { immutableSnapshot } from "./immutability.js";
import { assertPricingSnapshotCanBeSaved } from "./savePolicy.js";
import {
  snapshotPayloadHash,
  snapshotStorageKey,
} from "./snapshotPayload.js";

interface StoredSnapshot {
  readonly hash: string;
  readonly snapshot: PricingSnapshot;
}

export const createInMemoryPricingSnapshotRepository = (): PricingSnapshotRepository => {
  const snapshots = new Map<string, StoredSnapshot>();

  return {
    save(snapshot) {
      const key = snapshotStorageKey(snapshot.modelRunId, snapshot.scenarioId);
      const existing = snapshots.get(key);
      if (existing) {
        assertPricingSnapshotCanBeSaved(this, snapshot);
        return immutableSnapshot(existing.snapshot);
      }

      const immutable = immutableSnapshot(snapshot);
      snapshots.set(key, {
        hash: snapshotPayloadHash(snapshot),
        snapshot: immutable,
      });
      return immutableSnapshot(immutable);
    },
    get(modelRunId, scenarioId) {
      const existing = scenarioId === undefined
        ? [...snapshots.values()].find(entry => entry.snapshot.modelRunId === modelRunId)
        : snapshots.get(snapshotStorageKey(modelRunId, scenarioId));
      return existing ? immutableSnapshot(existing.snapshot) : undefined;
    },
    findLatest(filters) {
      let latest: PricingSnapshot | undefined;
      for (const entry of snapshots.values()) {
        const snapshot = entry.snapshot;
        if (
          snapshot.leagueId === filters.leagueId
          && String(snapshot.seasonYear) === String(filters.seasonYear)
          && (filters.modelRunId === undefined || snapshot.modelRunId === filters.modelRunId)
          && (filters.scenarioId === undefined || snapshot.scenarioId === filters.scenarioId)
        ) latest = snapshot;
      }
      return latest === undefined ? undefined : immutableSnapshot(latest);
    },
    list() {
      return [...snapshots.values()].map(entry => immutableSnapshot(entry.snapshot));
    },
  };
};
