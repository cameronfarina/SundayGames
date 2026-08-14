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
import {
  defaultLiveDraftImportBodyLimitBytes,
  defaultLiveDraftJsonBodyLimitBytes,
  type CreateLiveDraftServerOptions,
  type LiveDraftServerApp,
} from "../src/liveDraftServer.js";
import {
  createPlatformDraftToolsAdapter,
  type PlatformDraftToolsAdapter,
} from "../src/platform/platformDraftToolsAdapter.js";
import { MockBatchResourceManager } from "../src/mockBatchResourceManager.js";

interface DelegatedRequest {
  body: string;
  method: string;
  url: string;
}

const adapters: PlatformDraftToolsAdapter[] = [];
const outerServers: Server[] = [];
const temporaryDirectories: string[] = [];
const seasonId = "league-100001-season-2026";
const authorizeEverySeason = async (): Promise<boolean> => true;

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
  it("leaves every product page to the unified platform shell", async () => {
    const baseSessionDirectory = await temporaryDirectory();
    const delegatedRequests: DelegatedRequest[] = [];
    const createClassicServer = vi.fn(async () => recordingClassicServer(delegatedRequests));
    const resolveAccount = vi.fn(async () => ({ id: "account-owner11" }));
    const adapter = createPlatformDraftToolsAdapter({
      authorizeSeason: authorizeEverySeason,
      baseSessionDirectory,
      createLiveDraftServer: createClassicServer,
      resolveAccount,
    });
    const baseUrl = await listen(adapter);

    const paths = [
      `/mock-results?seasonId=${seasonId}&owner=Owner11`,
      `/simulations?seasonId=${seasonId}&strategy=three-rb`,
      `/strategy?seasonId=${seasonId}&owner=Owner11`,
      `/my-expert?seasonId=${seasonId}&week=5`,
      `/player-news?seasonId=${seasonId}&category=Injury`,
    ];

    for (const path of paths) {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { "x-test-account-id": "account-owner11" },
      });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "platform fallback" });
    }

    expect(delegatedRequests).toEqual([]);
    expect(resolveAccount).not.toHaveBeenCalled();
    expect(createClassicServer).not.toHaveBeenCalled();
  });

  it("leaves canonical board and mock draft routes to the platform shell", async () => {
    const baseSessionDirectory = await temporaryDirectory();
    const resolveAccount = vi.fn(async () => ({ id: "account-owner11" }));
    const createClassicServer = vi.fn(async () => recordingClassicServer([]));
    const adapter = createPlatformDraftToolsAdapter({
      authorizeSeason: authorizeEverySeason,
      baseSessionDirectory,
      createLiveDraftServer: createClassicServer,
      resolveAccount,
    });
    const baseUrl = await listen(adapter);

    for (const path of [
      "/board",
      `/board?seasonId=${seasonId}`,
      "/mock-drafts",
      `/mock-drafts?seasonId=${seasonId}`,
    ]) {
      const response = await fetch(`${baseUrl}${path}`);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "platform fallback" });
    }

    expect(resolveAccount).not.toHaveBeenCalled();
    expect(createClassicServer).not.toHaveBeenCalled();
  });

  it("delegates API methods and bodies to one isolated unbound app per account and season", async () => {
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
      authorizeSeason: authorizeEverySeason,
      baseSessionDirectory,
      createLiveDraftServer: createClassicServer,
      resolveAccount: async request => {
        const accountId = request.headers["x-test-account-id"];
        return typeof accountId === "string" ? { id: accountId } : null;
      },
    });
    const baseUrl = await listen(adapter);

    for (const [accountId, requestSeasonId] of [
      ["account-a", "season-a"],
      ["account-a", "season-b"],
      ["account-b", "season-a"],
    ] as const) {
      const response = await fetch(
        `${baseUrl}/api/events?seasonId=${requestSeasonId}&draftSession=practice`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-test-account-id": accountId,
          },
          body: JSON.stringify({ command: `${accountId} drafted Puka Nacua for 40` }),
        },
      );
      expect(response.status).toBe(200);
    }

    expect(createClassicServer).toHaveBeenCalledTimes(3);
    expect(classicApps.every(app => app.server.listening === false)).toBe(true);

    const sessionDirectories = createClassicServer.mock.calls.map(([options]) =>
      options.sessionDirectory
    );
    expect(new Set(sessionDirectories).size).toBe(3);
    for (const directory of sessionDirectories) {
      expect(directory).toMatch(
        new RegExp(`^${baseSessionDirectory}/account-[a-f0-9]{64}/season-[a-f0-9]{64}$`),
      );
    }

    const allRequests = [...requestsByDirectory.values()].flat();
    expect(allRequests).toHaveLength(3);
    expect(allRequests).toEqual(expect.arrayContaining([
      expect.objectContaining({
        method: "POST",
        url: "/api/events?seasonId=season-a&draftSession=practice",
        body: JSON.stringify({ command: "account-a drafted Puka Nacua for 40" }),
      }),
      expect.objectContaining({
        method: "POST",
        url: "/api/events?seasonId=season-b&draftSession=practice",
        body: JSON.stringify({ command: "account-a drafted Puka Nacua for 40" }),
      }),
      expect.objectContaining({
        method: "POST",
        url: "/api/events?seasonId=season-a&draftSession=practice",
        body: JSON.stringify({ command: "account-b drafted Puka Nacua for 40" }),
      }),
    ]));
  });

  it("resolves season options before creating every account and season app", async () => {
    const baseSessionDirectory = await temporaryDirectory();
    const seasonOptions = new Map<string, CreateLiveDraftServerOptions>([
      ["season-a", {
        projections: [{
          id: 101,
          name: "Season A Player",
          position: "WR",
          weeks: { 1: 12 },
          weeks1To4: 12,
        }],
      }],
      ["season-b", {
        projections: [{
          id: 202,
          name: "Season B Player",
          position: "RB",
          weeks: { 1: 18 },
          weeks1To4: 18,
        }],
      }],
    ]);
    const resolveSeasonOptions = vi.fn(async (requestedSeasonId: string) =>
      seasonOptions.get(requestedSeasonId) ?? null
    );
    const createClassicServer = vi.fn(async (_options: CreateLiveDraftServerOptions) =>
      recordingClassicServer([])
    );
    const adapter = createPlatformDraftToolsAdapter({
      authorizeSeason: authorizeEverySeason,
      baseSessionDirectory,
      createLiveDraftServer: createClassicServer,
      resolveAccount: async request => ({
        id: String(request.headers["x-test-account-id"] ?? "account-a"),
      }),
      resolveSeasonOptions,
    });
    const baseUrl = await listen(adapter);

    for (const [accountId, requestSeasonId] of [
      ["account-a", "season-a"],
      ["account-b", "season-a"],
      ["account-a", "season-b"],
    ] as const) {
      const response = await fetch(`${baseUrl}/api/state?seasonId=${requestSeasonId}`, {
        headers: { "x-test-account-id": accountId },
      });
      expect(response.status).toBe(200);
    }

    expect(resolveSeasonOptions.mock.calls).toEqual([
      ["season-a"],
      ["season-a"],
      ["season-b"],
    ]);
    expect(createClassicServer).toHaveBeenCalledTimes(3);
    for (const [index, requestSeasonId] of ["season-a", "season-a", "season-b"].entries()) {
      expect(resolveSeasonOptions.mock.invocationCallOrder[index]).toBeLessThan(
        createClassicServer.mock.invocationCallOrder[index] ?? Number.POSITIVE_INFINITY,
      );
      expect(createClassicServer.mock.calls[index]?.[0]).toEqual({
        ...seasonOptions.get(requestSeasonId),
        importMaxBodyBytes: defaultLiveDraftImportBodyLimitBytes,
        legacyMockBatchEnabled: false,
        maxBodyBytes: defaultLiveDraftJsonBodyLimitBytes,
        mockBatchResourceManager: expect.any(MockBatchResourceManager),
        mockBatchResourceScope: {
          accountId: index === 1 ? "account-b" : "account-a",
          seasonId: requestSeasonId,
        },
        sessionDirectory: expect.stringMatching(
          new RegExp(`/season-${createHash("sha256").update(requestSeasonId).digest("hex")}$`),
        ),
      });
    }
    expect(new Set(createClassicServer.mock.calls.map(
      ([appOptions]) => appOptions.mockBatchResourceManager,
    ))).toHaveLength(1);
  });

  it("passes platform body limits to every delegated draft tools app", async () => {
    const baseSessionDirectory = await temporaryDirectory();
    const createClassicServer = vi.fn(async () => recordingClassicServer([]));
    const adapter = createPlatformDraftToolsAdapter({
      authorizeSeason: authorizeEverySeason,
      baseSessionDirectory,
      createLiveDraftServer: createClassicServer,
      importMaxBodyBytes: 200,
      legacyMockBatchEnabled: true,
      maxBodyBytes: 100,
      resolveAccount: async () => ({ id: "account-owner11" }),
    });
    const baseUrl = await listen(adapter);

    expect((await fetch(`${baseUrl}/api/state?seasonId=${seasonId}`)).status).toBe(200);
    expect(createClassicServer).toHaveBeenCalledWith(expect.objectContaining({
      importMaxBodyBytes: 200,
      legacyMockBatchEnabled: true,
      maxBodyBytes: 100,
    }));
  });

  it("returns a typed unavailable response when a legacy route has no draft tools options", async () => {
    const baseSessionDirectory = await temporaryDirectory();
    const resolveSeasonOptions = vi.fn(async () => null);
    const createClassicServer = vi.fn(async () => recordingClassicServer([]));
    const adapter = createPlatformDraftToolsAdapter({
      authorizeSeason: authorizeEverySeason,
      baseSessionDirectory,
      createLiveDraftServer: createClassicServer,
      resolveAccount: async () => ({ id: "account-owner11" }),
      resolveSeasonOptions,
    });
    const baseUrl = await listen(adapter);

    const unavailableResponse = await fetch(`${baseUrl}/api/state?seasonId=${seasonId}`);
    expect(unavailableResponse.status).toBe(503);
    expect(unavailableResponse.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(await unavailableResponse.json()).toEqual({
      error: {
        code: "draft_tools_unavailable",
        message: "Draft tools are not available for this league yet.",
      },
    });

    expect(resolveSeasonOptions).toHaveBeenCalledOnce();
    expect(createClassicServer).not.toHaveBeenCalled();
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
      authorizeSeason: authorizeEverySeason,
      baseSessionDirectory,
      createLiveDraftServer: createClassicServer,
      resolveAccount,
    });
    const baseUrl = await listen(adapter);

    const boardRequest = fetch(`${baseUrl}/api/board?seasonId=${seasonId}`);
    const stateRequest = fetch(`${baseUrl}/api/state?seasonId=${seasonId}`);
    await vi.waitFor(() => expect(createClassicServer).toHaveBeenCalledTimes(1));
    releaseCreation?.();

    expect((await boardRequest).status).toBe(200);
    expect((await stateRequest).status).toBe(200);
    expect(resolveAccount).toHaveBeenCalledTimes(2);
    expect(createClassicServer).toHaveBeenCalledTimes(1);
    expect(createClassicServer).toHaveBeenCalledWith({
      importMaxBodyBytes: defaultLiveDraftImportBodyLimitBytes,
      legacyMockBatchEnabled: false,
      maxBodyBytes: defaultLiveDraftJsonBodyLimitBytes,
      mockBatchResourceManager: expect.any(MockBatchResourceManager),
      mockBatchResourceScope: {
        accountId: "../../same-account",
        seasonId,
      },
      sessionDirectory: join(
        baseSessionDirectory,
        `account-${createHash("sha256").update("../../same-account").digest("hex")}`,
        `season-${createHash("sha256").update(seasonId).digest("hex")}`,
      ),
    });
  });

  it("returns JSON for unauthenticated legacy APIs", async () => {
    const baseSessionDirectory = await temporaryDirectory();
    const createClassicServer = vi.fn(async () => recordingClassicServer([]));
    const resolveAccount = vi.fn(async () => null);
    const adapter = createPlatformDraftToolsAdapter({
      authorizeSeason: authorizeEverySeason,
      baseSessionDirectory,
      createLiveDraftServer: createClassicServer,
      resolveAccount,
    });
    const baseUrl = await listen(adapter);

    const apiResponse = await fetch(`${baseUrl}/api/state?seasonId=${seasonId}`);

    expect(apiResponse.status).toBe(401);
    expect(apiResponse.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(await apiResponse.json()).toEqual({
      error: {
        code: "auth_required",
        message: "Sign in to continue.",
      },
    });
    expect(resolveAccount).toHaveBeenCalledOnce();
    expect(createClassicServer).not.toHaveBeenCalled();
  });

  it("does not authenticate or consume unrelated platform routes", async () => {
    const baseSessionDirectory = await temporaryDirectory();
    const resolveAccount = vi.fn(async () => ({ id: "account-owner11" }));
    const createClassicServer = vi.fn(async () => recordingClassicServer([]));
    const adapter = createPlatformDraftToolsAdapter({
      authorizeSeason: authorizeEverySeason,
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
      authorizeSeason: authorizeEverySeason,
      baseSessionDirectory,
      resolveAccount: async () => {
        throw new Error("session database password appeared here");
      },
    });
    const resolverBaseUrl = await listen(resolverAdapter);

    const resolverResponse = await fetch(`${resolverBaseUrl}/api/state?seasonId=${seasonId}`);
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
      authorizeSeason: authorizeEverySeason,
      baseSessionDirectory,
      createLiveDraftServer: createClassicServer,
      resolveAccount: async () => ({ id: "account-owner11" }),
    });
    const factoryBaseUrl = await listen(factoryAdapter);

    const factoryResponse = await fetch(`${factoryBaseUrl}/api/state?seasonId=${seasonId}`);
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

    const retryResponse = await fetch(`${factoryBaseUrl}/api/state?seasonId=${seasonId}`);
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
      authorizeSeason: authorizeEverySeason,
      baseSessionDirectory,
      createLiveDraftServer: createClassicServer,
      resolveAccount: async request => ({
        id: String(request.headers["x-test-account-id"] ?? "account-a"),
      }),
    });
    const baseUrl = await listen(adapter);

    await fetch(`${baseUrl}/api/state?seasonId=season-a`, {
      headers: { "x-test-account-id": "account-a" },
    });
    await fetch(`${baseUrl}/api/state?seasonId=season-a`, {
      headers: { "x-test-account-id": "account-b" },
    });
    expect(createClassicServer).toHaveBeenCalledTimes(2);

    await adapter.clearAccount("account-a");
    expect(classicApps[0]?.server.listenerCount("request")).toBe(0);

    await fetch(`${baseUrl}/api/state?seasonId=season-a`, {
      headers: { "x-test-account-id": "account-a" },
    });
    expect(createClassicServer).toHaveBeenCalledTimes(3);

    await adapter.close();
    expect(classicApps.every(app => app.server.listenerCount("request") === 0)).toBe(true);

    const responseAfterClose = await fetch(`${baseUrl}/api/state?seasonId=season-a`, {
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

  it("requires one valid season id before authorizing or creating a classic app", async () => {
    const baseSessionDirectory = await temporaryDirectory();
    const authorizeSeason = vi.fn(async () => true);
    const createClassicServer = vi.fn(async () => recordingClassicServer([]));
    const adapter = createPlatformDraftToolsAdapter({
      authorizeSeason,
      baseSessionDirectory,
      createLiveDraftServer: createClassicServer,
      resolveAccount: async () => ({ id: "account-owner11" }),
    });
    const baseUrl = await listen(adapter);

    for (const path of [
      "/api/state?seasonId=",
      "/api/state?seasonId=season-a&seasonId=season-b",
      "/api/state?seasonId=not%20valid",
    ]) {
      const response = await fetch(`${baseUrl}${path}`);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: {
          code: "season_required",
          message: "Choose a valid league season before opening draft tools.",
        },
      });
    }

    expect(authorizeSeason).not.toHaveBeenCalled();
    expect(createClassicServer).not.toHaveBeenCalled();
  });

  it("denies accounts without membership in the requested season", async () => {
    const baseSessionDirectory = await temporaryDirectory();
    const authorizeSeason = vi.fn(async () => false);
    const createClassicServer = vi.fn(async () => recordingClassicServer([]));
    const adapter = createPlatformDraftToolsAdapter({
      authorizeSeason,
      baseSessionDirectory,
      createLiveDraftServer: createClassicServer,
      resolveAccount: async () => ({ id: "account-outsider" }),
    });
    const baseUrl = await listen(adapter);

    const apiResponse = await fetch(`${baseUrl}/api/state?seasonId=${seasonId}`);

    expect(apiResponse.status).toBe(403);
    expect(await apiResponse.json()).toEqual({
      error: {
        code: "membership_required",
        message: "Join this league before opening its draft tools.",
      },
    });
    expect(authorizeSeason).toHaveBeenCalledOnce();
    expect(authorizeSeason).toHaveBeenCalledWith(
      { id: "account-outsider" },
      seasonId,
      expect.anything(),
    );
    expect(createClassicServer).not.toHaveBeenCalled();
  });

  it("evicts idle season apps before exceeding the retained app limit", async () => {
    const baseSessionDirectory = await temporaryDirectory();
    const classicApps: LiveDraftServerApp[] = [];
    let currentTime = 1_000;
    const createClassicServer = vi.fn(async () => {
      const app = recordingClassicServer([]);
      classicApps.push(app);
      return app;
    });
    const adapter = createPlatformDraftToolsAdapter({
      authorizeSeason: authorizeEverySeason,
      baseSessionDirectory,
      createLiveDraftServer: createClassicServer,
      idleTimeoutMs: 10,
      maxRetainedApps: 2,
      now: () => currentTime,
      resolveAccount: async () => ({ id: "account-owner11" }),
    });
    const baseUrl = await listen(adapter);

    await fetch(`${baseUrl}/api/state?seasonId=season-a`);
    currentTime += 5;
    await fetch(`${baseUrl}/api/state?seasonId=season-b`);
    currentTime += 6;
    await fetch(`${baseUrl}/api/state?seasonId=season-c`);

    expect(createClassicServer).toHaveBeenCalledTimes(3);
    expect(classicApps[0]?.server.listenerCount("request")).toBe(0);
    expect(classicApps[1]?.server.listenerCount("request")).toBe(1);
    expect(classicApps[2]?.server.listenerCount("request")).toBe(1);

    await fetch(`${baseUrl}/api/state?seasonId=season-a`);
    expect(createClassicServer).toHaveBeenCalledTimes(4);
  });

  it("keeps apps with retained background work while evicting disposable apps", async () => {
    const baseSessionDirectory = await temporaryDirectory();
    const classicApps: LiveDraftServerApp[] = [];
    const createClassicServer = vi.fn(async () => {
      const retainsBackgroundWork = classicApps.length === 0;
      const app = {
        ...recordingClassicServer([]),
        canDispose: () => !retainsBackgroundWork,
      };
      classicApps.push(app);
      return app;
    });
    const adapter = createPlatformDraftToolsAdapter({
      authorizeSeason: authorizeEverySeason,
      baseSessionDirectory,
      createLiveDraftServer: createClassicServer,
      maxRetainedApps: 2,
      resolveAccount: async () => ({ id: "account-owner11" }),
    });
    const baseUrl = await listen(adapter);

    expect((await fetch(`${baseUrl}/api/state?seasonId=season-a`)).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/state?seasonId=season-b`)).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/state?seasonId=season-c`)).status).toBe(200);

    expect(createClassicServer).toHaveBeenCalledTimes(3);
    expect(classicApps[0]?.server.listenerCount("request")).toBe(1);
    expect(classicApps[1]?.server.listenerCount("request")).toBe(0);
    expect(classicApps[2]?.server.listenerCount("request")).toBe(1);

    expect((await fetch(`${baseUrl}/api/state?seasonId=season-a`)).status).toBe(200);
    expect(createClassicServer).toHaveBeenCalledTimes(3);
  });
});
