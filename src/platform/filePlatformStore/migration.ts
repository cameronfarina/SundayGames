import type { InMemoryPlatformStoreSnapshot } from "../platformApp.js";
import { writePlatformAuthSnapshot } from "./authSnapshot.js";
import {
  withoutEmbeddedAuth,
  writePlatformStoreSnapshot,
} from "./workspaceSnapshot.js";

export const migrateLegacyPlatformAuthSnapshot = async (
  path: string,
  snapshot: InMemoryPlatformStoreSnapshot,
): Promise<void> => {
  await writePlatformAuthSnapshot(`${path}.auth.json`, snapshot.auth);
  await writePlatformStoreSnapshot(path, withoutEmbeddedAuth(snapshot));
};
