import type { InMemoryPlatformStoreSnapshot } from "../platformApp.js";
import {
  deserializePlatformStoreSnapshot,
  emptyPlatformStoreSnapshot,
  serializePlatformStoreSnapshot,
} from "../platformStoreSnapshotCodec.js";
import { readTextIfPresent, writeJsonAtomically } from "./filesystem.js";

export const emptyAuthSnapshot = (): InMemoryPlatformStoreSnapshot["auth"] => ({
  accountCredentials: [],
  sessions: [],
});

export const withoutEmbeddedAuth = (
  snapshot: InMemoryPlatformStoreSnapshot,
): InMemoryPlatformStoreSnapshot => ({
  ...snapshot,
  auth: emptyAuthSnapshot(),
});

export const readPlatformStoreSnapshot = async (
  path: string,
): Promise<InMemoryPlatformStoreSnapshot> => {
  const content = await readTextIfPresent(path);
  if (content === null || content.trim().length === 0) return emptyPlatformStoreSnapshot();
  const value: unknown = JSON.parse(content);
  return deserializePlatformStoreSnapshot(value);
};

export const writePlatformStoreSnapshot = async (
  path: string,
  snapshot: InMemoryPlatformStoreSnapshot,
): Promise<void> => {
  const serialized = serializePlatformStoreSnapshot(snapshot);
  await writeJsonAtomically(path, `${JSON.stringify(serialized)}\n`);
};
