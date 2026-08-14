import type { InMemoryPlatformStoreSnapshot } from "../platformApp.js";

export interface SerializedPlatformStoreSnapshot extends InMemoryPlatformStoreSnapshot {
  schemaVersion: 1;
}
