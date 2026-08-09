import { createServer, type Server } from "node:http";
import { FilePlatformStore } from "./filePlatformStore.js";
import {
  createPlatformApp,
  InMemoryPlatformStore,
} from "./platformApp.js";
import {
  createPlatformHttpHandler,
  type PlatformApp,
  type PlatformHttpHandler,
  type PlatformHttpRequest,
} from "./platformHttp.js";
import {
  createPlatformJobHandlers,
} from "./platformJobHandlers.js";
import type { PlatformJobHandlers } from "./platformJobOrchestrator.js";
import { createPlatformNodeHttpAdapter } from "./platformNodeHttp.js";
import type { SimulationMockBatchRunner } from "./simulations.js";

export type PlatformClock = () => Date;

export interface CreatePlatformServerOptions {
  dataFilePath?: string | undefined;
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
  dataFilePath: string | undefined,
): Promise<{ store: InMemoryPlatformStore; fileStore?: FilePlatformStore | undefined }> => {
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
  const { store, fileStore } = await loadStore(options.dataFilePath);
  const app = createPlatformApp({
    store,
    simulationRunner: options.simulationRunner,
  });
  const platformHandler = createPlatformHttpHandler(app);
  const persist = async (): Promise<void> => {
    await fileStore?.save();
  };
  const jobHandlers = createPlatformJobHandlers({ app, persist });
  const handler: PlatformHttpHandler = async request => {
    const requestWithNow = withDefaultNow(request, options.now);
    const response = await platformHandler(requestWithNow);

    if (shouldPersistAfter(requestWithNow, response.status)) {
      await persist();
    }

    return response;
  };
  const server = createServer(createPlatformNodeHttpAdapter(handler, {
    maxBodyBytes: options.bodyLimitBytes,
  }));
  const platformServer = {
    server,
    app,
    store,
    handler,
    jobHandlers,
    persist,
    close: () => closeServer(server),
    ...(fileStore === undefined ? {} : { fileStore }),
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
    ...platformServer,
    host,
    port: startedPort,
    url: `http://${hostForUrl(host)}:${startedPort}`,
  };
};
