import type { PlatformHttpResponse } from "../platformHttp.js";
import { PostgresPlatformStoreError } from "../postgresPlatformStore.js";
import type { PlatformRuntimeHolder } from "./internalContracts.js";
import { createAsyncReadWriteLock } from "./serialization.js";

export const snapshotWriteConflictResponse: PlatformHttpResponse = {
  status: 409,
  body: {
    error: {
      code: "snapshot_write_conflict",
      message: "Stored draft data changed before this request could be saved. Reload and try again.",
    },
  },
};

export const isSnapshotWriteConflict = (error: unknown): error is PostgresPlatformStoreError =>
  error instanceof PostgresPlatformStoreError && error.code === "snapshot_write_conflict";

export interface PlatformPersistence {
  rawPersist(): Promise<void>;
  persist(): Promise<void>;
  runWithSnapshotReadAccess<T>(operation: () => Promise<T>): Promise<T>;
  runInSnapshotCriticalSection<T>(operation: () => Promise<T>): Promise<T>;
}

export const createPlatformPersistence = (
  runtimeHolder: PlatformRuntimeHolder,
  reloadRuntime: () => Promise<void>,
): PlatformPersistence => {
  const snapshotAccess = createAsyncReadWriteLock();
  const runWithSnapshotReadAccess = async <T>(operation: () => Promise<T>): Promise<T> => {
    if (runtimeHolder.current().postgresStore === undefined) return await operation();
    return await snapshotAccess.read(operation);
  };
  const runInSnapshotCriticalSection = async <T>(operation: () => Promise<T>): Promise<T> => {
    if (runtimeHolder.current().postgresStore === undefined) return await operation();
    return await snapshotAccess.write(operation);
  };
  const rawPersist = async (): Promise<void> => {
    const runtime = runtimeHolder.current();
    try {
      await runtime.fileStore?.save();
      await runtime.postgresStore?.save();
    } catch (error) {
      if (isSnapshotWriteConflict(error)) await reloadRuntime();
      throw error;
    }
  };
  return {
    rawPersist,
    persist: () => runInSnapshotCriticalSection(rawPersist),
    runWithSnapshotReadAccess,
    runInSnapshotCriticalSection,
  };
};
