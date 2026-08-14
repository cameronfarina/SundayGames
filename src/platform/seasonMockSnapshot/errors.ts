import {
  seasonMockConfigurationSnapshotMaxBytes,
  seasonMockSnapshotStorageLimitLabel,
} from "./constants.js";
import { SeasonMockConfigurationSnapshotError } from "./contracts.js";

export const malformedSnapshot = (): never => {
  throw new SeasonMockConfigurationSnapshotError(
    "snapshot_malformed",
    "Mock draft configuration snapshot is malformed.",
  );
};

export const assertSnapshotSize = (value: unknown): void => {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return malformedSnapshot();
  }

  if (serialized === undefined) return malformedSnapshot();
  if (Buffer.byteLength(serialized, "utf8") > seasonMockConfigurationSnapshotMaxBytes) {
    throw new SeasonMockConfigurationSnapshotError(
      "snapshot_too_large",
      `Mock draft configuration snapshot exceeds the ${seasonMockSnapshotStorageLimitLabel} storage limit.`,
    );
  }
};
