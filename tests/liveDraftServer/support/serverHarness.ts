import { mkdtemp } from "node:fs/promises";
import { request as httpRequest, type ClientRequest, type IncomingMessage } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createLiveDraftServer as createRuntimeLiveDraftServer,
  type CreateLiveDraftServerOptions,
} from "../../../src/liveDraftServer.js";

export { createRuntimeLiveDraftServer };

export const tempSessionDirectory = async (): Promise<string> =>
  mkdtemp(join(tmpdir(), "mockd-live-draft-server-"));

export const createLiveDraftServer = (
  options: CreateLiveDraftServerOptions = {},
) => createRuntimeLiveDraftServer({
  legacyMockBatchEnabled: true,
  scratchSessionsEnabled: true,
  ...options,
});

export type TestServer = Awaited<ReturnType<typeof createLiveDraftServer>>["server"];

export const servers: TestServer[] = [];

export const closeTestServers = async (): Promise<void> => {
  await Promise.all(servers.map(server => new Promise<void>(resolve => {
    server.close(() => resolve());
  })));
  servers.length = 0;
};

export const listen = async (server: TestServer): Promise<string> =>
  new Promise(resolve => {
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected TCP test server address.");
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });

export const post = async (
  baseUrl: string,
  path: string,
  body: Record<string, unknown> = {},
) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    data: await response.json(),
  };
};

export const collectJsonResponse = async (
  request: ClientRequest,
): Promise<{ status: number; data: unknown }> =>
  await new Promise((resolve, reject) => {
    request.once("response", (response: IncomingMessage) => {
      const chunks: Buffer[] = [];
      response.on("data", chunk => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      response.on("end", () => {
        resolve({
          status: response.statusCode ?? 0,
          data: JSON.parse(Buffer.concat(chunks).toString("utf8")),
        });
      });
    });
    request.once("error", reject);
  });

export { httpRequest };

export const waitForMockBatchJob = async (
  baseUrl: string,
  jobId: string,
  owner = "Owner11",
  draftSession = "live",
) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const params = new URLSearchParams({ owner, draftSession });
    const job = await fetch(`${baseUrl}/api/mock-batch/${jobId}?${params}`)
      .then(response => response.json());
    if (job.status === "complete" || job.status === "failed") return job;
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  throw new Error(`Mock batch job ${jobId} did not complete in test.`);
};

type SyncEnvKey =
  | "MOCKD_YAHOO_CLIENT_ID"
  | "MOCKD_YAHOO_CLIENT_SECRET"
  | "MOCKD_YAHOO_REDIRECT_URI"
  | "MOCKD_ESPN_LEAGUE_ID"
  | "MOCKD_ESPN_SWID"
  | "MOCKD_ESPN_S2";

export const syncEnvKeys: readonly SyncEnvKey[] = [
  "MOCKD_YAHOO_CLIENT_ID",
  "MOCKD_YAHOO_CLIENT_SECRET",
  "MOCKD_YAHOO_REDIRECT_URI",
  "MOCKD_ESPN_LEAGUE_ID",
  "MOCKD_ESPN_SWID",
  "MOCKD_ESPN_S2",
];

type SyncEnvSnapshot = Partial<Record<SyncEnvKey, string>>;

export const snapshotSyncEnv = (): SyncEnvSnapshot =>
  Object.fromEntries(syncEnvKeys.flatMap(key => {
    const value = process.env[key];
    return value === undefined ? [] : [[key, value]];
  }));

export const restoreSyncEnv = (snapshot: SyncEnvSnapshot): void => {
  for (const key of syncEnvKeys) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};
