import { createServer, type Server } from "node:http";
import { FilePlatformStore } from "./filePlatformStore.js";
import {
  createPlatformApp,
  InMemoryPlatformStore,
} from "./platformApp.js";
import {
  PostgresPlatformStore,
  PostgresPlatformStoreError,
  type PostgresQueryClient,
} from "./postgresPlatformStore.js";
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
import type { SimulationMockBatchRunner } from "./simulations.js";

export type PlatformClock = () => Date;

export interface CreatePlatformServerOptions {
  dataFilePath?: string | undefined;
  postgresClient?: PostgresQueryClient | undefined;
  postgresSnapshotKey?: string | undefined;
  initializePostgresSchema?: boolean | undefined;
  simulationRunner: SimulationMockBatchRunner;
  bodyLimitBytes?: number | undefined;
  now?: PlatformClock | undefined;
}

export interface PlatformServer {
  server: Server;
  app: PlatformApp;
  store: InMemoryPlatformStore;
  handler: PlatformHttpHandler;
  jobHandlers: PlatformJobHandlers;
  fileStore?: FilePlatformStore | undefined;
  postgresStore?: PostgresPlatformStore | undefined;
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
  interface Runtime {
    store: InMemoryPlatformStore;
    app: PlatformApp;
    platformHandler: PlatformHttpHandler;
    rawJobHandlers: PlatformJobHandlers;
    fileStore?: FilePlatformStore | undefined;
    postgresStore?: PostgresPlatformStore | undefined;
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
    const app = createPlatformApp({
      store,
      simulationRunner: options.simulationRunner,
    });

    return {
      store,
      app,
      platformHandler: createPlatformHttpHandler(app),
      rawJobHandlers: createPlatformJobHandlers({ app, persist: rawPersist }),
      ...(fileStore === undefined ? {} : { fileStore }),
      ...(postgresStore === undefined ? {} : { postgresStore }),
    };
  };

  runtime = createRuntime(await loadStore(options));

  const handler: PlatformHttpHandler = async request => {
    const runRequest = async (): Promise<Awaited<ReturnType<PlatformHttpHandler>>> => {
      const requestWithNow = withDefaultNow(request, options.now);
      const response = await runtime.platformHandler(requestWithNow);

      if (shouldPersistAfter(requestWithNow, response.status)) {
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
    persist: platformServer.persist,
    close: platformServer.close,
    host,
    port: startedPort,
    url: `http://${hostForUrl(host)}:${startedPort}`,
  };
};
