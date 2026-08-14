import { request as httpRequest, type ClientRequest } from "node:http";
import type { PlatformServer } from "../../../src/platform/platformServer.js";
import type { JsonFetchResult } from "./domainFixtures.js";

export const deferred = (): { promise: Promise<void>; resolve: () => void } => {
  let resolve: (() => void) | undefined;
  const promise = new Promise<void>(innerResolve => {
    resolve = innerResolve;
  });
  if (resolve === undefined) throw new Error("Expected Promise executor to initialize resolve.");

  return { promise, resolve };
};

export const listen = async (platformServer: PlatformServer): Promise<string> => {
  await new Promise<void>((resolve, reject) => {
    platformServer.server.once("error", reject);
    platformServer.server.listen(0, "127.0.0.1", resolve);
  });

  const address = platformServer.server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Expected TCP test server address.");
  }

  return `http://127.0.0.1:${address.port}`;
};

export const jsonFetch = async (
  baseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<JsonFetchResult> => {
  const response = await fetch(`${baseUrl}${path}`, init);
  const setCookie = response.headers.get("set-cookie");
  const retryAfter = response.headers.get("retry-after");

  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    ...(setCookie === null ? {} : { setCookie }),
    ...(retryAfter === null ? {} : { retryAfter }),
    body: await response.json(),
  };
};

export interface ParsedEventStreamEvent {
  event: string;
  data: unknown;
}

export const openEventStream = async (
  baseUrl: string,
  path: string,
  sessionToken: string,
): Promise<{
  response: Response;
  nextEvent: () => Promise<ParsedEventStreamEvent>;
  close: () => Promise<void>;
}> => {
  const controller = new AbortController();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "x-session-token": sessionToken },
    signal: controller.signal,
  });
  const reader = response.body?.getReader();
  if (reader === undefined) throw new Error("Expected event stream response body.");
  const decoder = new TextDecoder();
  let buffer = "";

  const nextEvent = async (): Promise<ParsedEventStreamEvent> => {
    while (true) {
      const boundary = buffer.indexOf("\n\n");
      if (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const lines = block.split("\n");
        const event = lines.find(line => line.startsWith("event: "))?.slice("event: ".length);
        const data = lines.find(line => line.startsWith("data: "))?.slice("data: ".length);
        if (event !== undefined && data !== undefined) {
          const parsedData: unknown = JSON.parse(data);
          return { event, data: parsedData };
        }
        continue;
      }

      const chunk = await reader.read();
      if (chunk.done) throw new Error("Event stream closed before the next event.");
      buffer += decoder.decode(chunk.value, { stream: true });
    }
  };

  return {
    response,
    nextEvent,
    close: async () => {
      await reader.cancel();
    },
  };
};

export const requestBeforeSendingBody = async (
  baseUrl: string,
  path: string,
  sessionToken?: string,
): Promise<{
  request: ClientRequest;
  response: JsonFetchResult;
}> => {
  let clientRequest: ClientRequest | undefined;
  const response = new Promise<JsonFetchResult>((resolve, reject) => {
    const request = httpRequest(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-length": "1000",
        "content-type": "application/json",
        ...(sessionToken === undefined ? {} : { "x-session-token": sessionToken }),
      },
    }, incomingResponse => {
      const chunks: Buffer[] = [];
      incomingResponse.on("data", chunk => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      incomingResponse.on("end", () => {
        const setCookie = incomingResponse.headers["set-cookie"]?.[0];
        resolve({
          status: incomingResponse.statusCode ?? 0,
          contentType: incomingResponse.headers["content-type"] ?? null,
          ...(setCookie === undefined ? {} : { setCookie }),
          ...(incomingResponse.headers["retry-after"] === undefined
            ? {}
            : { retryAfter: incomingResponse.headers["retry-after"] }),
          body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
        });
      });
    });
    clientRequest = request;
    request.once("error", reject);
    request.flushHeaders();
  });
  if (clientRequest === undefined) throw new Error("Expected HTTP request to initialize synchronously.");
  const request = clientRequest;

  const guardedResponse = await new Promise<JsonFetchResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      request.destroy();
      reject(new Error("Server waited for the request body."));
    }, 250);
    response.then(result => {
      clearTimeout(timeout);
      resolve(result);
    }, error => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  return { request, response: guardedResponse };
};

export const textFetch = async (
  baseUrl: string,
  path: string,
): Promise<{ status: number; contentType: string | null; body: string }> => {
  const response = await fetch(`${baseUrl}${path}`);

  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    body: await response.text(),
  };
};
