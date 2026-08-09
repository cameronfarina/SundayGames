import { createServer, type Server } from "node:http";
import { FilePlatformStore } from "./filePlatformStore.js";
import type { JobRepository } from "./jobs.js";
import {
  createPlatformApp,
  InMemoryPlatformStore,
} from "./platformApp.js";
import {
  PostgresJobQueue,
  type PostgresTransactionalQueryClient,
} from "./postgresJobQueue.js";
import {
  PostgresPlatformStore,
  PostgresPlatformStoreError,
  type PostgresQueryClient,
} from "./postgresPlatformStore.js";
import { PostgresSimulationRepository } from "./postgresSimulations.js";
import {
  createPlatformHttpHandler,
  type PlatformApp,
  type PlatformHttpHandler,
  type PlatformHttpRequest,
} from "./platformHttp.js";
import {
  createPlatformJobHandlers,
} from "./platformJobHandlers.js";
import {
  platformJobTypes,
  type PlatformJobHandlers,
} from "./platformJobOrchestrator.js";
import { createPlatformNodeHttpAdapter } from "./platformNodeHttp.js";
import type {
  SimulationMockBatchRunner,
  SimulationRepository,
} from "./simulations.js";

export type PlatformClock = () => Date;

export interface CreatePlatformServerOptions {
  dataFilePath?: string | undefined;
  postgresClient?: PostgresQueryClient | undefined;
  postgresJobClient?: PostgresTransactionalQueryClient | undefined;
  postgresSimulationClient?: PostgresTransactionalQueryClient | undefined;
  postgresSnapshotKey?: string | undefined;
  initializePostgresSchema?: boolean | undefined;
  jobRepository?: JobRepository | undefined;
  simulationRepository?: SimulationRepository | undefined;
  simulationRunner: SimulationMockBatchRunner;
  bodyLimitBytes?: number | undefined;
  now?: PlatformClock | undefined;
}

export interface PlatformServer {
  server: Server;
  app: PlatformApp;
  store: InMemoryPlatformStore;
  jobRepository: JobRepository;
  simulationRepository: SimulationRepository;
  handler: PlatformHttpHandler;
  jobHandlers: PlatformJobHandlers;
  fileStore?: FilePlatformStore | undefined;
  postgresStore?: PostgresPlatformStore | undefined;
  postgresJobQueue?: PostgresJobQueue | undefined;
  postgresSimulationRepository?: PostgresSimulationRepository | undefined;
  persist: () => Promise<void>;
  close: () => Promise<void>;
}

export interface StartPlatformServerOptions extends CreatePlatformServerOptions {
  host?: string | undefined;
  port?: number | undefined;
}

export interface StartedPlatformServer extends PlatformServer {
  host: string;
  port: number;
  url: string;
}

const mutatingHttpMethods = new Set(["DELETE", "PATCH", "POST", "PUT"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const requestPathHasNow = (path: string): boolean => {
  try {
    return new URL(path, "http://mockd.local").searchParams.has("now");
  } catch {
    return false;
  }
};

const requestHasNow = (request: PlatformHttpRequest): boolean => {
  const bodyNow = isRecord(request.body) ? request.body.now : undefined;

  return bodyNow !== undefined || request.query?.now !== undefined || requestPathHasNow(request.path);
};

const withDefaultNow = (
  request: PlatformHttpRequest,
  now: PlatformClock | undefined,
): PlatformHttpRequest => {
  if (now === undefined || requestHasNow(request)) return request;

  return {
    ...request,
    query: {
      ...(request.query ?? {}),
      now: now(),
    },
  };
};

const shouldPersistAfter = (
  request: PlatformHttpRequest,
  responseStatus: number,
): boolean =>
  mutatingHttpMethods.has(request.method.toUpperCase()) &&
  responseStatus >= 200 &&
  responseStatus < 300;

const isJobOnlyMutationRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;

  try {
    const segments = new URL(request.path, "http://mockd.local").pathname
      .split("/")
      .filter(Boolean)
      .map(segment => decodeURIComponent(segment));

    return segments[0] === "simulations" &&
      segments.length === 3 &&
      (segments[2] === "jobs" || segments[2] === "enqueue");
  } catch {
    return false;
  }
};

const isSimulationOnlyMutationRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;

  try {
    const segments = new URL(request.path, "http://mockd.local").pathname
      .split("/")
      .filter(Boolean)
      .map(segment => decodeURIComponent(segment));

    return segments[0] === "simulations" &&
      (
        segments.length === 1 ||
        (segments.length === 3 && segments[2] === "execute")
      );
  } catch {
    return false;
  }
};

const isJobAndSimulationOnlyMutationRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;

  try {
    const segments = new URL(request.path, "http://mockd.local").pathname
      .split("/")
      .filter(Boolean)
      .map(segment => decodeURIComponent(segment));

    return segments[0] === "jobs" &&
      segments.length === 3 &&
      (segments[2] === "cancel" || segments[2] === "rerun");
  } catch {
    return false;
  }
};

const snapshotWriteConflictResponse = {
  status: 409,
  body: {
    error: {
      code: "snapshot_write_conflict",
      message: "Stored draft data changed before this request could be saved. Reload and try again.",
    },
  },
} as const;

const isSnapshotWriteConflict = (error: unknown): error is PostgresPlatformStoreError =>
  error instanceof PostgresPlatformStoreError && error.code === "snapshot_write_conflict";

const serializeAsyncOperations = () => {
  let chain = Promise.resolve();

  return async <T>(operation: () => Promise<T>): Promise<T> => {
    const result = chain.then(operation, operation);
    chain = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  };
};

const closeServer = async (server: Server): Promise<void> => {
  if (!server.listening) return;

  await new Promise<void>((resolve, reject) => {
    server.close(error => {
      if (error === undefined) resolve();
      else reject(error);
    });
  });
};

const loadStore = async (
  options: Pick<
    CreatePlatformServerOptions,
    "dataFilePath" | "initializePostgresSchema" | "now" | "postgresClient" | "postgresSnapshotKey"
  >,
): Promise<{
  store: InMemoryPlatformStore;
  fileStore?: FilePlatformStore | undefined;
  postgresStore?: PostgresPlatformStore | undefined;
}> => {
  if (options.dataFilePath !== undefined && options.postgresClient !== undefined) {
    throw new Error("Configure either dataFilePath or postgresClient, not both.");
  }

  if (options.postgresClient !== undefined) {
    if (options.initializePostgresSchema === true) {
      await PostgresPlatformStore.initializeSchema(options.postgresClient);
    }

    const postgresStore = await PostgresPlatformStore.load(options.postgresClient, {
      snapshotKey: options.postgresSnapshotKey,
      now: options.now,
    });

    return {
      store: postgresStore.store,
      postgresStore,
    };
  }

  const dataFilePath = options.dataFilePath;
  if (dataFilePath === undefined) {
    return { store: new InMemoryPlatformStore() };
  }

  const fileStore = await FilePlatformStore.load(dataFilePath);

  return {
    store: fileStore.store,
    fileStore,
  };
};

const listen = async (
  server: Server,
  port: number,
  host: string,
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
};

const hostForUrl = (host: string): string => host.includes(":") ? `[${host}]` : host;

export const createPlatformServer = async (
  options: CreatePlatformServerOptions,
): Promise<PlatformServer> => {
  if (options.jobRepository !== undefined && options.postgresJobClient !== undefined) {
    throw new Error("Configure either jobRepository or postgresJobClient, not both.");
  }
  if (options.simulationRepository !== undefined && options.postgresSimulationClient !== undefined) {
    throw new Error("Configure either simulationRepository or postgresSimulationClient, not both.");
  }

  interface Runtime {
    store: InMemoryPlatformStore;
    jobRepository: JobRepository;
    simulationRepository: SimulationRepository;
    app: PlatformApp;
    platformHandler: PlatformHttpHandler;
    rawJobHandlers: PlatformJobHandlers;
    fileStore?: FilePlatformStore | undefined;
    postgresStore?: PostgresPlatformStore | undefined;
    postgresJobQueue?: PostgresJobQueue | undefined;
    postgresSimulationRepository?: PostgresSimulationRepository | undefined;
  }

  let runtime: Runtime;
  const runSerializedForSnapshotStore = serializeAsyncOperations();
  const runInSnapshotCriticalSection = async <T>(operation: () => Promise<T>): Promise<T> =>
    runtime.postgresStore === undefined
      ? operation()
      : runSerializedForSnapshotStore(operation);

  const rawPersist = async (): Promise<void> => {
    try {
      await runtime.fileStore?.save();
      await runtime.postgresStore?.save();
    } catch (error) {
      if (isSnapshotWriteConflict(error) && options.postgresClient !== undefined) {
        runtime = createRuntime(await loadStore({
          postgresClient: options.postgresClient,
          postgresSnapshotKey: options.postgresSnapshotKey,
          now: options.now,
        }));
      }

      throw error;
    }
  };
  const persist = async (): Promise<void> => runInSnapshotCriticalSection(rawPersist);
  const jobHandlers: PlatformJobHandlers = {
    [platformJobTypes.simulationRunExecution]: (payload, context) =>
      runInSnapshotCriticalSection(() =>
        Promise.resolve(runtime.rawJobHandlers[platformJobTypes.simulationRunExecution](payload, context))
      ),
    [platformJobTypes.historicalImportParse]: (payload, context) =>
      runInSnapshotCriticalSection(() =>
        Promise.resolve(runtime.rawJobHandlers[platformJobTypes.historicalImportParse](payload, context))
      ),
    [platformJobTypes.pricingRebuild]: (payload, context) =>
      runInSnapshotCriticalSection(() =>
        Promise.resolve(runtime.rawJobHandlers[platformJobTypes.pricingRebuild](payload, context))
      ),
    [platformJobTypes.draftRoomExport]: (payload, context) =>
      runInSnapshotCriticalSection(() =>
        Promise.resolve(runtime.rawJobHandlers[platformJobTypes.draftRoomExport](payload, context))
      ),
  };

  const createRuntime = ({
    store,
    fileStore,
    postgresStore,
  }: Awaited<ReturnType<typeof loadStore>>): Runtime => {
    const postgresJobQueue = options.postgresJobClient === undefined
      ? undefined
      : new PostgresJobQueue(options.postgresJobClient);
    const postgresSimulationRepository = options.postgresSimulationClient === undefined
      ? undefined
      : new PostgresSimulationRepository(options.postgresSimulationClient);
    const jobRepository = options.jobRepository ?? postgresJobQueue ?? store.jobs;
    const simulationRepository = options.simulationRepository ?? postgresSimulationRepository ?? store.simulations;
    const app = createPlatformApp({
      store,
      jobRepository,
      simulationRepository,
      simulationRunner: options.simulationRunner,
    });

    return {
      store,
      app,
      platformHandler: createPlatformHttpHandler(app),
      rawJobHandlers: createPlatformJobHandlers({
        app,
        persist: simulationRepository === store.simulations ? rawPersist : undefined,
      }),
      jobRepository,
      simulationRepository,
      ...(fileStore === undefined ? {} : { fileStore }),
      ...(postgresStore === undefined ? {} : { postgresStore }),
      ...(postgresJobQueue === undefined ? {} : { postgresJobQueue }),
      ...(postgresSimulationRepository === undefined ? {} : { postgresSimulationRepository }),
    };
  };

  runtime = createRuntime(await loadStore(options));

  const handler: PlatformHttpHandler = async request => {
    const runRequest = async (): Promise<Awaited<ReturnType<PlatformHttpHandler>>> => {
      const requestWithNow = withDefaultNow(request, options.now);
      const response = await runtime.platformHandler(requestWithNow);
      const usesExternalJobRepository = runtime.jobRepository !== runtime.store.jobs;
      const usesExternalSimulationRepository = runtime.simulationRepository !== runtime.store.simulations;
      const skipSnapshotPersist =
        (
          usesExternalJobRepository &&
          isJobOnlyMutationRequest(requestWithNow)
        ) ||
        (
          usesExternalSimulationRepository &&
          isSimulationOnlyMutationRequest(requestWithNow)
        ) ||
        (
          usesExternalJobRepository &&
          usesExternalSimulationRepository &&
          isJobAndSimulationOnlyMutationRequest(requestWithNow)
        );

      if (
        shouldPersistAfter(requestWithNow, response.status) &&
        !skipSnapshotPersist
      ) {
        try {
          await rawPersist();
        } catch (error) {
          if (isSnapshotWriteConflict(error)) return snapshotWriteConflictResponse;

          throw error;
        }
      }

      return response;
    };

    return runInSnapshotCriticalSection(runRequest);
  };
  const server = createServer(createPlatformNodeHttpAdapter(handler, {
    maxBodyBytes: options.bodyLimitBytes,
  }));
  const platformServer = {
    server,
    get app() {
      return runtime.app;
    },
    get store() {
      return runtime.store;
    },
    get jobRepository() {
      return runtime.jobRepository;
    },
    get simulationRepository() {
      return runtime.simulationRepository;
    },
    handler,
    get jobHandlers() {
      return jobHandlers;
    },
    persist,
    close: () => closeServer(server),
    get fileStore() {
      return runtime.fileStore;
    },
    get postgresStore() {
      return runtime.postgresStore;
    },
    get postgresJobQueue() {
      return runtime.postgresJobQueue;
    },
    get postgresSimulationRepository() {
      return runtime.postgresSimulationRepository;
    },
  };

  return platformServer;
};

export const startPlatformServer = async (
  options: StartPlatformServerOptions,
): Promise<StartedPlatformServer> => {
  const { host = "127.0.0.1", port = 0, ...serverOptions } = options;
  const platformServer = await createPlatformServer(serverOptions);

  await listen(platformServer.server, port, host);

  const address = platformServer.server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Expected platform server to listen on a TCP address.");
  }

  const startedPort = address.port;

  return {
    server: platformServer.server,
    get app() {
      return platformServer.app;
    },
    get store() {
      return platformServer.store;
    },
    get jobRepository() {
      return platformServer.jobRepository;
    },
    get simulationRepository() {
      return platformServer.simulationRepository;
    },
    handler: platformServer.handler,
    get jobHandlers() {
      return platformServer.jobHandlers;
    },
    get fileStore() {
      return platformServer.fileStore;
    },
    get postgresStore() {
      return platformServer.postgresStore;
    },
    get postgresJobQueue() {
      return platformServer.postgresJobQueue;
    },
    get postgresSimulationRepository() {
      return platformServer.postgresSimulationRepository;
    },
    persist: platformServer.persist,
    close: platformServer.close,
    host,
    port: startedPort,
    url: `http://${hostForUrl(host)}:${startedPort}`,
  };
};
