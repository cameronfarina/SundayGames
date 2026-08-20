import type { LiveDraftRoomRevisionNotifier } from "../liveDraftRoomRealtime.js";
import type { PlatformHttpHandler, PlatformHttpResponse } from "../platformHttp.js";
import type { CreatePlatformServerOptions } from "./contracts.js";
import { DraftMutationResponseRollback, draftMutationSeasonIdFor } from "./draftMutation.js";
import type { PlatformRuntimeHolder } from "./internalContracts.js";
import { notifyLiveDraftRoomRevision } from "./liveDraftRevision.js";
import type { PlatformPersistence } from "./persistence.js";
import { isTransactionalPostgresClient } from "./postgres.js";
import { isLeagueMembersScreenshotAnalysisRequest, isSeasonSimulationRequest } from "./requestKinds.js";
import { isMutatingRequest, withTrustedNow, shouldPersistAfter } from "./requestTiming.js";
import type { SeasonSimulationCapture } from "./simulationCapture.js";
import { shouldBypassSnapshotAccess } from "./snapshotPersistencePolicy.js";

interface CreateRequestHandlerOptions {
  options: CreatePlatformServerOptions;
  runtimeHolder: PlatformRuntimeHolder;
  persistence: PlatformPersistence;
  runRequest: PlatformHttpHandler;
  simulationCapture: SeasonSimulationCapture;
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
  if (isSeasonSimulationRequest(requestWithNow)) {
    const prepared = await input.persistence.runInSnapshotCriticalSection(() =>
      input.simulationCapture.prepare(() => input.runRequest(requestWithNow))
    );
    const response = await prepared.response;
    const runtime = input.runtimeHolder.current();
    if (runtime.simulationRepository === runtime.store.simulations &&
        shouldPersistAfter(requestWithNow, response.status)) {
      await input.persistence.persist();
    }
    return response;
  }
  const runtime = input.runtimeHolder.current();
  const seasonId = await draftMutationSeasonIdFor(requestWithNow, runtime.liveDraftRoomRepository);
  const postgresClient = input.options.postgresClient;
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
  if (!isMutatingRequest(requestWithNow)) {
    response = await input.persistence.runWithSnapshotReadAccess(() =>
      input.runRequest(requestWithNow)
    );
  } else if (shouldBypassSnapshotAccess(input.runtimeHolder.current(), requestWithNow)) {
    response = await input.runRequest(requestWithNow);
  } else {
    response = await input.persistence.runInSnapshotCriticalSection(() =>
      input.runRequest(requestWithNow)
    );
  }
  notifyLiveDraftRoomRevision(input.liveDraftRoomNotifier, requestWithNow, response);
  return response;
};
