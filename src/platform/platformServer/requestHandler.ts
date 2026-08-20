import type { LiveDraftRoomRevisionNotifier } from "../liveDraftRoomRealtime.js";
import type { PlatformHttpHandler, PlatformHttpResponse } from "../platformHttp.js";
import type { CreatePlatformServerOptions } from "./contracts.js";
import { DraftMutationResponseRollback, draftMutationSeasonIdFor } from "./draftMutation.js";
import type { PlatformRuntimeHolder } from "./internalContracts.js";
import { notifyLiveDraftRoomRevision } from "./liveDraftRevision.js";
import {
  isSnapshotWriteConflict,
  snapshotWriteConflictResponse,
  type PlatformPersistence,
} from "./persistence.js";
import { isTransactionalPostgresClient } from "./postgres.js";
import { isLeagueMembersScreenshotAnalysisRequest } from "./requestKinds.js";
import { isMutatingRequest, withTrustedNow } from "./requestTiming.js";
import {
  requiresAtomicPracticeDualWrite,
  shouldBypassSnapshotAccess,
} from "./snapshotPersistencePolicy.js";

class PracticeMutationResponseRollback extends Error {
  constructor(readonly response: PlatformHttpResponse) {
    super(`Practice mutation returned HTTP ${response.status}.`);
  }
}

interface CreateRequestHandlerOptions {
  options: CreatePlatformServerOptions;
  runtimeHolder: PlatformRuntimeHolder;
  persistence: PlatformPersistence;
  runRequest: PlatformHttpHandler;
  liveDraftRoomNotifier: LiveDraftRoomRevisionNotifier;
  reloadRuntime: () => Promise<void>;
}

export const createPlatformRequestHandler = (
  input: CreateRequestHandlerOptions,
): PlatformHttpHandler => async request => {
  const requestWithNow = withTrustedNow(request, input.options.now);
  if (isLeagueMembersScreenshotAnalysisRequest(requestWithNow)) {
    return input.runRequest(requestWithNow);
  }
  const runtime = input.runtimeHolder.current();
  const postgresClient = input.options.postgresClient;
  if (requiresAtomicPracticeDualWrite(runtime, requestWithNow) &&
      postgresClient !== undefined && isTransactionalPostgresClient(postgresClient)) {
    return await input.persistence.runInSnapshotCriticalSection(async () => {
      try {
        return await postgresClient.transaction(async transactionClient => {
          const postgresStore = input.runtimeHolder.current().postgresStore;
          if (postgresStore === undefined) {
            throw new Error("Dual-write practice persistence requires a Postgres snapshot store.");
          }
          await postgresStore.lockForAtomicSave(transactionClient);
          const response = await input.runRequest(requestWithNow);
          if (response.status >= 400) throw new PracticeMutationResponseRollback(response);
          return response;
        });
      } catch (error) {
        await input.reloadRuntime();
        if (isSnapshotWriteConflict(error)) return snapshotWriteConflictResponse;
        if (error instanceof PracticeMutationResponseRollback) return error.response;
        throw error;
      }
    });
  }
  const seasonId = await draftMutationSeasonIdFor(requestWithNow, runtime.liveDraftRoomRepository);
  if (seasonId !== null && postgresClient !== undefined &&
      isTransactionalPostgresClient(postgresClient)) {
    return input.persistence.runInSnapshotCriticalSection(async () => {
      let response: PlatformHttpResponse;
      try {
        response = await postgresClient.transaction(async client => {
          await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
            `mockd:draft-mutation:${seasonId}`,
          ]);
          const transactionalResponse = await input.runRequest(requestWithNow);
          if (transactionalResponse.status >= 400) {
            throw new DraftMutationResponseRollback(transactionalResponse);
          }
          return transactionalResponse;
        });
      } catch (error) {
        await input.reloadRuntime();
        if (error instanceof DraftMutationResponseRollback) response = error.response;
        else throw error;
      }
      notifyLiveDraftRoomRevision(input.liveDraftRoomNotifier, requestWithNow, response);
      return response;
    });
  }
  let response: PlatformHttpResponse;
  if (shouldBypassSnapshotAccess(input.runtimeHolder.current(), requestWithNow)) {
    response = await input.runRequest(requestWithNow);
  } else if (!isMutatingRequest(requestWithNow)) {
    response = await input.persistence.runWithSnapshotReadAccess(() =>
      input.runRequest(requestWithNow)
    );
  } else {
    response = await input.persistence.runInSnapshotCriticalSection(() =>
      input.runRequest(requestWithNow)
    );
  }
  notifyLiveDraftRoomRevision(input.liveDraftRoomNotifier, requestWithNow, response);
  return response;
};
