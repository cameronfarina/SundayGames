import type { PlatformHttpHandler, PlatformHttpRequest } from "../platformHttp.js";
import type { PlatformRuntimeHolder } from "./internalContracts.js";
import {
  isSnapshotWriteConflict,
  snapshotWriteConflictResponse,
  type PlatformPersistence,
} from "./persistence.js";
import { shouldPersistAfter } from "./requestTiming.js";
import { shouldSkipSnapshotPersist, usesFileAuthSidecarFor } from "./snapshotPersistencePolicy.js";

export const createRuntimeRequest = (
  runtimeHolder: PlatformRuntimeHolder,
  persistence: PlatformPersistence,
): PlatformHttpHandler => async (request: PlatformHttpRequest) => {
  const runtime = runtimeHolder.current();
  const response = await runtime.platformHandler(request);
  const shouldPersist = shouldPersistAfter(request, response.status);
  if (shouldPersist && usesFileAuthSidecarFor(runtime, request)) {
    await runtime.fileStore?.saveAuth();
  } else if (shouldPersist && !shouldSkipSnapshotPersist(runtime, request)) {
    try {
      await persistence.rawPersist();
    } catch (error) {
      if (isSnapshotWriteConflict(error)) return snapshotWriteConflictResponse;
      throw error;
    }
  }
  return response;
};
