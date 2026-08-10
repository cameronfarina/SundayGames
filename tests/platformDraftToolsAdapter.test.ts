import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CreateLiveDraftServerOptions,
  LiveDraftServerApp,
} from "../src/liveDraftServer.js";
import {
  createPlatformDraftToolsAdapter,
  type PlatformDraftToolsAdapter,
} from "../src/platform/platformDraftToolsAdapter.js";

interface DelegatedRequest {
  body: string;
  method: string;
  url: string;
}

const adapters: PlatformDraftToolsAdapter[] = [];
const outerServers: Server[] = [];
const temporaryDirectories: string[] = [];

const temporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "mockd-platform-draft-tools-"));
  temporaryDirectories.push(directory);
  return directory;
};

const listen = async (adapter: PlatformDraftToolsAdapter): Promise<string> => {
  adapters.push(adapter);
  const server = createServer(async (request, response) => {
    if (await adapter(request, response)) return;

    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "platform fallback" }));
  });
  outerServers.push(server);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Expected a TCP server address.");
  }

  return `http://127.0.0.1:${address.port}`;
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

const requestBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
};

const recordingClassicServer = (
  requests: DelegatedRequest[],
  responseFor: (request: IncomingMessage) => unknown = request => ({ delegatedUrl: request.url }),
): LiveDraftServerApp => ({
  server: createServer(async (request, response) => {
    const body = await requestBody(request);
    requests.push({
      body,
      method: request.method ?? "GET",
      url: request.url ?? "/",
    });
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(responseFor(request)));
  }),
});

afterEach(async () => {
  await Promise.all(adapters.splice(0).map(adapter => adapter.close()));
  await Promise.all(outerServers.splice(0).map(closeServer));
  await Promise.all(temporaryDirectories.splice(0).map(directory =>
    rm(directory, { force: true, recursive: true })
  ));
});

describe("platform draft tools adapter", () => {
  it("maps authenticated product pages to the classic draft workspace", async () => {
    const baseSessionDirectory = await temporaryDirectory();
    const delegatedRequests: DelegatedRequest[] = [];
    const createClassicServer = vi.fn(async () => recordingClassicServer(delegatedRequests));
    const resolveAccount = vi.fn(async () => ({ id: "account-cam" }));
    const adapter = createPlatformDraftToolsAdapter({
      baseSessionDirectory,
      createLiveDraftServer: createClassicServer,
      resolveAccount,
    });
    const baseUrl = await listen(adapter);

    const paths = [
      "/board?mode=interactive-mock&strategy=balanced",
      "/mock-drafts?mode=real&draftSession=practice-3rb",
      "/mock-results?owner=Cam",
      "/simulations?strategy=three-rb",
      "/my-expert?week=5",
      "/player-news?category=Injury",
    ];

    for (const path of paths) {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { "x-test-account-id": "account-cam" },
      });
      expect(response.status).toBe(200);
    }

    expect(delegatedRequests.map(request => request.url)).toEqual([
      "/draft-room?mode=real&strategy=balanced",
      "/draft-room?mode=interactive-mock&draftSession=practice-3rb",
      "/mock-results?owner=Cam",
      "/mock-simulations?strategy=three-rb",
      "/my-expert?week=5",
      "/player-news?category=Injury",
    ]);
    expect(resolveAccount).toHaveBeenCalledTimes(paths.length);
    expect(createClassicServer).toHaveBeenCalledTimes(1);
  });

  it("delegates API methods and bodies to one isolated unbound app per account", async () => {
    const baseSessionDirectory = await temporaryDirectory();
    const requestsByDirectory = new Map<string, DelegatedRequest[]>();
    const classicApps: LiveDraftServerApp[] = [];
    const createClassicServer = vi.fn(async (options: CreateLiveDraftServerOptions) => {
      const directory = options.sessionDirectory ?? "";
      const requests: DelegatedRequest[] = [];
      requestsByDirectory.set(directory, requests);
      const app = recordingClassicServer(requests);
      classicApps.push(app);
      return app;
    });
    const adapter = createPlatformDraftToolsAdapter({
      baseSessionDirectory,
      createLiveDraftServer: createClassicServer,
      resolveAccount: async request => {
        const accountId = request.headers["x-test-account-id"];
        return typeof accountId === "string" ? { id: accountId } : null;
      },
    });
    const baseUrl = await listen(adapter);

    for (const accountId of ["account-a", "account-a", "account-b"]) {
      const response = await fetch(`${baseUrl}/api/events?draftSession=practice`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-test-account-id": accountId,
        },
        body: JSON.stringify({ command: `${accountId} drafted Puka Nacua for 40` }),
      });
      expect(response.status).toBe(200);
    }

    expect(createClassicServer).toHaveBeenCalledTimes(2);
    expect(classicApps.every(app => app.server.listening === false)).toBe(true);

    const sessionDirectories = createClassicServer.mock.calls.map(([options]) =>
      options.sessionDirectory
    );
    expect(new Set(sessionDirectories).size).toBe(2);
    for (const directory of sessionDirectories) {
      expect(directory).toMatch(new RegExp(`^${baseSessionDirectory}/account-[a-f0-9]{64}$`));
    }

    const allRequests = [...requestsByDirectory.values()].flat();
    expect(allRequests).toHaveLength(3);
    expect(allRequests).toEqual(expect.arrayContaining([
      expect.objectContaining({
        method: "POST",
        url: "/api/events?draftSession=practice",
        body: JSON.stringify({ command: "account-a drafted Puka Nacua for 40" }),
      }),
      expect.objectContaining({
        method: "POST",
        url: "/api/events?draftSession=practice",
        body: JSON.stringify({ command: "account-b drafted Puka Nacua for 40" }),
      }),
    ]));
  });

  it("authenticates every concurrent request while creating one app for the account", async () => {
    const baseSessionDirectory = await temporaryDirectory();
    const delegatedRequests: DelegatedRequest[] = [];
    let releaseCreation: (() => void) | undefined;
    const creationGate = new Promise<void>(resolve => {
      releaseCreation = resolve;
    });
    const createClassicServer = vi.fn(async () => {
      await creationGate;
      return recordingClassicServer(delegatedRequests);
    });
    const resolveAccount = vi.fn(async () => ({ id: "../../same-account" }));
    const adapter = createPlatformDraftToolsAdapter({
      baseSessionDirectory,
      createLiveDraftServer: createClassicServer,
      resolveAccount,
    });
    const baseUrl = await listen(adapter);

    const boardRequest = fetch(`${baseUrl}/board`);
    const stateRequest = fetch(`${baseUrl}/api/state`);
    await vi.waitFor(() => expect(createClassicServer).toHaveBeenCalledTimes(1));
    releaseCreation?.();

    expect((await boardRequest).status).toBe(200);
    expect((await stateRequest).status).toBe(200);
    expect(resolveAccount).toHaveBeenCalledTimes(2);
    expect(createClassicServer).toHaveBeenCalledTimes(1);
    expect(createClassicServer).toHaveBeenCalledWith({
      sessionDirectory: join(
        baseSessionDirectory,
        `account-${createHash("sha256").update("../../same-account").digest("hex")}`,
      ),
    });
  });

  it("redirects unauthenticated page requests and returns JSON for unauthenticated APIs", async () => {
    const baseSessionDirectory = await temporaryDirectory();
    const createClassicServer = vi.fn(async () => recordingClassicServer([]));
    const resolveAccount = vi.fn(async () => null);
    const adapter = createPlatformDraftToolsAdapter({
      baseSessionDirectory,
      createLiveDraftServer: createClassicServer,
      resolveAccount,
    });
    const baseUrl = await listen(adapter);

    const pageResponse = await fetch(`${baseUrl}/board?strategy=three-rb`, { redirect: "manual" });
    const apiResponse = await fetch(`${baseUrl}/api/state`);

    expect(pageResponse.status).toBe(302);
    expect(pageResponse.headers.get("location")).toBe(
      "/login?returnTo=%2Fboard%3Fstrategy%3Dthree-rb",
    );
    expect(pageResponse.headers.get("cache-control")).toBe("no-store");
    expect(apiResponse.status).toBe(401);
    expect(apiResponse.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(await apiResponse.json()).toEqual({
      error: {
        code: "auth_required",
        message: "Sign in to continue.",
      },
    });
    expect(resolveAccount).toHaveBeenCalledTimes(2);
    expect(createClassicServer).not.toHaveBeenCalled();
  });

  it("does not authenticate or consume unrelated platform routes", async () => {
    const baseSessionDirectory = await temporaryDirectory();
    const resolveAccount = vi.fn(async () => ({ id: "account-cam" }));
    const createClassicServer = vi.fn(async () => recordingClassicServer([]));
    const adapter = createPlatformDraftToolsAdapter({
      baseSessionDirectory,
      createLiveDraftServer: createClassicServer,
      resolveAccount,
    });
    const baseUrl = await listen(adapter);

    const response = await fetch(`${baseUrl}/league`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "platform fallback" });
    expect(resolveAccount).not.toHaveBeenCalled();
    expect(createClassicServer).not.toHaveBeenCalled();
  });

  it("returns a stable internal error without leaking resolver or server errors", async () => {
    const baseSessionDirectory = await temporaryDirectory();
    const resolverAdapter = createPlatformDraftToolsAdapter({
      baseSessionDirectory,
      resolveAccount: async () => {
        throw new Error("session database password appeared here");
      },
    });
    const resolverBaseUrl = await listen(resolverAdapter);

    const resolverResponse = await fetch(`${resolverBaseUrl}/api/state`);
    const resolverBody = await resolverResponse.text();

    expect(resolverResponse.status).toBe(500);
    expect(JSON.parse(resolverBody)).toEqual({
      error: {
        code: "internal_error",
        message: "Something went wrong.",
      },
    });
    expect(resolverBody).not.toContain("database password");

    const createClassicServer = vi.fn()
      .mockRejectedValueOnce(new Error("private filesystem location appeared here"))
      .mockResolvedValueOnce(recordingClassicServer([]));
    const factoryAdapter = createPlatformDraftToolsAdapter({
      baseSessionDirectory,
      createLiveDraftServer: createClassicServer,
      resolveAccount: async () => ({ id: "account-cam" }),
    });
    const factoryBaseUrl = await listen(factoryAdapter);

    const factoryResponse = await fetch(`${factoryBaseUrl}/board`, { redirect: "manual" });
    const factoryBody = await factoryResponse.text();

    expect(factoryResponse.status).toBe(500);
    expect(factoryResponse.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(JSON.parse(factoryBody)).toEqual({
      error: {
        code: "internal_error",
        message: "Something went wrong.",
      },
    });
    expect(factoryBody).not.toContain("filesystem location");

    const retryResponse = await fetch(`${factoryBaseUrl}/board`);
    expect(retryResponse.status).toBe(200);
    expect(createClassicServer).toHaveBeenCalledTimes(2);
  });

  it("clears account apps for recreation and closes every cached app", async () => {
    const baseSessionDirectory = await temporaryDirectory();
    const classicApps: LiveDraftServerApp[] = [];
    const createClassicServer = vi.fn(async () => {
      const app = recordingClassicServer([]);
      classicApps.push(app);
      return app;
    });
    const adapter = createPlatformDraftToolsAdapter({
      baseSessionDirectory,
      createLiveDraftServer: createClassicServer,
      resolveAccount: async request => ({
        id: String(request.headers["x-test-account-id"] ?? "account-a"),
      }),
    });
    const baseUrl = await listen(adapter);

    await fetch(`${baseUrl}/api/state`, { headers: { "x-test-account-id": "account-a" } });
    await fetch(`${baseUrl}/api/state`, { headers: { "x-test-account-id": "account-b" } });
    expect(createClassicServer).toHaveBeenCalledTimes(2);

    await adapter.clearAccount("account-a");
    expect(classicApps[0]?.server.listenerCount("request")).toBe(0);

    await fetch(`${baseUrl}/api/state`, { headers: { "x-test-account-id": "account-a" } });
    expect(createClassicServer).toHaveBeenCalledTimes(3);

    await adapter.close();
    expect(classicApps.every(app => app.server.listenerCount("request") === 0)).toBe(true);

    const responseAfterClose = await fetch(`${baseUrl}/api/state`, {
      headers: { "x-test-account-id": "account-a" },
    });
    expect(responseAfterClose.status).toBe(500);
    expect(await responseAfterClose.json()).toEqual({
      error: {
        code: "internal_error",
        message: "Something went wrong.",
      },
    });
  });
});
