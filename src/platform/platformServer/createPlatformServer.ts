import {
  isPostgresNotificationClient,
  LiveDraftRoomRevisionNotifier,
  PostgresLiveDraftRoomStreamAdmission,
  startPostgresLiveDraftRoomRevisionListener,
} from "../liveDraftRoomRealtime.js";
import { finalizePracticePersistenceCutover } from "../practicePersistenceCutover.js";
import { createPlatformAdmissions } from "./admissions.js";
import type { CreatePlatformServerOptions, PlatformServer } from "./contracts.js";
import { createDraftToolsAdapter } from "./draftTools.js";
import { createPlatformRuntimeHolder, type PlatformRuntimeFactory } from "./internalContracts.js";
import { createDelegatingJobHandlers } from "./jobHandlers.js";
import { createNodeServer } from "./nodeServer.js";
import { validatePlatformServerOptions } from "./optionValidation.js";
import { createPlatformPersistence } from "./persistence.js";
import { createPlatformServerShape } from "./platformServerShape.js";
import { initializePostgresSchemas, isTransactionalPostgresClient } from "./postgres.js";
import { createPlatformRequestHandler } from "./requestHandler.js";
import { createRuntimeRequest } from "./runtimeRequest.js";
import { createPlatformRuntimeFactory } from "./runtimeFactory.js";
import { loadPlatformStore } from "./storeLoader.js";

export const createPlatformServer = async (
  options: CreatePlatformServerOptions,
): Promise<PlatformServer> => {
  validatePlatformServerOptions(options);
  await initializePostgresSchemas(options);
  if (options.practicePersistenceMode === "normalized-only" &&
      options.postgresClient !== undefined &&
      isTransactionalPostgresClient(options.postgresClient)) {
    await finalizePracticePersistenceCutover(options.postgresClient);
  }
  const runtimeHolder = createPlatformRuntimeHolder();
  let runtimeFactory: PlatformRuntimeFactory | undefined;
  const reloadRuntime = async (): Promise<void> => {
    if (options.postgresClient === undefined) return;
    if (runtimeFactory === undefined) throw new Error("Platform runtime factory is not initialized.");
    runtimeHolder.replace(runtimeFactory(await loadPlatformStore({
      postgresClient: options.postgresClient,
      postgresSnapshotKey: options.postgresSnapshotKey,
      now: options.now,
    })));
  };
  const persistence = createPlatformPersistence(runtimeHolder, reloadRuntime);
  const admissions = createPlatformAdmissions(options);
  const liveDraftRoomNotifier = new LiveDraftRoomRevisionNotifier({
    maxConcurrentWaitersPerAccount: options.liveDraftRoomEventStreamMaxConnectionsPerAccount,
    maxConcurrentWaiters: options.liveDraftRoomEventStreamMaxConnections,
    retryAfterSeconds: options.liveDraftRoomEventStreamRetryAfterSeconds,
  });
  const revisionNotificationClient = options.postgresLiveDraftRoomClient ?? options.postgresClient;
  const liveDraftRoomStreamAdmission = revisionNotificationClient !== undefined
      && isTransactionalPostgresClient(revisionNotificationClient)
    ? new PostgresLiveDraftRoomStreamAdmission(revisionNotificationClient, {
        maxConcurrentWaitersPerAccount: options.liveDraftRoomEventStreamMaxConnectionsPerAccount,
        maxConcurrentWaiters: options.liveDraftRoomEventStreamMaxConnections,
        retryAfterSeconds: options.liveDraftRoomEventStreamRetryAfterSeconds,
      })
    : undefined;
  runtimeFactory = createPlatformRuntimeFactory({
    options,
    admissions,
    liveDraftRoomNotifier,
    liveDraftRoomStreamAdmission,
    persistForJobs: persistence.rawPersist,
    runInSnapshotCriticalSection: persistence.runInSnapshotCriticalSection,
  });
  runtimeHolder.replace(runtimeFactory(await loadPlatformStore(options)));
  const runRequest = createRuntimeRequest(runtimeHolder, persistence);
  const handler = createPlatformRequestHandler({
    options,
    runtimeHolder,
    persistence,
    runRequest,
    liveDraftRoomNotifier,
    reloadRuntime,
  });
  const draftToolsAdapter = createDraftToolsAdapter(runtimeHolder, options);
  const nodeServer = createNodeServer(handler, draftToolsAdapter, runtimeHolder, options, admissions);
  const liveDraftRoomRevisionListener = isPostgresNotificationClient(revisionNotificationClient)
    ? await startPostgresLiveDraftRoomRevisionListener(
        revisionNotificationClient,
        liveDraftRoomNotifier,
      )
    : undefined;
  return createPlatformServerShape({
    server: nodeServer.server,
    runtimeHolder,
    handler,
    draftToolsAdapter,
    jobHandlers: createDelegatingJobHandlers(runtimeHolder, persistence),
    persist: persistence.persist,
    abortAndDrainActiveStreams: nodeServer.abortAndDrainActiveStreams,
    closeLiveDraftRoomRevisionListener: async () => {
      await liveDraftRoomRevisionListener?.close();
    },
  });
};
