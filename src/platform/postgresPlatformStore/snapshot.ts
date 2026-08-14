import { createHash } from "node:crypto";
import { serializePlatformStoreSnapshot } from "../platformStoreSnapshotCodec.js";
import type { InMemoryPlatformStoreSnapshot } from "../platformApp.js";

export const defaultSnapshotKey = "default";

export const snapshotHash = (snapshot: InMemoryPlatformStoreSnapshot): string =>
  createHash("sha256")
    .update(JSON.stringify(serializePlatformStoreSnapshot(snapshot)))
    .digest("hex");

export const snapshotJsonForPostgres = (snapshot: InMemoryPlatformStoreSnapshot): unknown => {
  const parsed: unknown = JSON.parse(JSON.stringify(serializePlatformStoreSnapshot(snapshot)));
  return parsed;
};
