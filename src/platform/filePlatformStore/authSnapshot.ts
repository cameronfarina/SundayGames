import type { InMemoryPlatformStoreSnapshot } from "../platformApp.js";
import { deserializePlatformStoreSnapshot } from "../platformStoreSnapshotCodec.js";
import { recordValue } from "../platformStoreSnapshotCodec/decoding/primitives.js";
import { readTextIfPresent, writeJsonAtomically } from "./filesystem.js";

export const containsAuthRecords = (auth: InMemoryPlatformStoreSnapshot["auth"]): boolean =>
  auth.accountCredentials.length > 0 || auth.sessions.length > 0;

export const writePlatformAuthSnapshot = async (
  path: string,
  auth: InMemoryPlatformStoreSnapshot["auth"],
): Promise<void> => {
  const value = { schemaVersion: 1, auth };
  await writeJsonAtomically(path, `${JSON.stringify(value)}\n`);
};

export const readPlatformAuthSnapshot = async (
  path: string,
): Promise<InMemoryPlatformStoreSnapshot["auth"] | null> => {
  const content = await readTextIfPresent(path);
  if (content === null || content.trim().length === 0) return null;
  const value: unknown = JSON.parse(content);
  const root = recordValue(value, "authSidecar");
  if (root.auth === undefined) return null;
  return deserializePlatformStoreSnapshot({
    schemaVersion: root.schemaVersion,
    auth: root.auth,
  }).auth;
};
