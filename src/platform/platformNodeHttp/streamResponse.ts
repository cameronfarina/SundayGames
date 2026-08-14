import { Buffer } from "node:buffer";
import type { ServerResponse } from "node:http";
import type { PlatformHttpResponse } from "../platformHttp.js";
import { applyPlatformResponseHeaders } from "./responseHeaders.js";
import { setDefaultSecurityHeaders } from "./securityHeaders.js";

export const isAsyncTextStream = (body: unknown): body is AsyncIterable<string> =>
  body !== null && typeof body === "object" && Symbol.asyncIterator in body;

export const writeAsyncTextStreamResponse = async (
  response: ServerResponse,
  platformResponse: PlatformHttpResponse,
  body: AsyncIterable<string>,
): Promise<void> => {
  response.statusCode = platformResponse.status;
  applyPlatformResponseHeaders(response, platformResponse.headers);
  setDefaultSecurityHeaders(response);
  response.flushHeaders();

  for await (const chunk of body) {
    if (response.destroyed) return;
    if (!response.write(chunk)) {
      await new Promise<void>(resolve => {
        const resume = (): void => {
          response.removeListener("drain", resume);
          response.removeListener("close", resume);
          resolve();
        };
        response.once("drain", resume);
        response.once("close", resume);
      });
    }
  }
  if (!response.destroyed) response.end();
};

export const writeEventStreamTextResponse = (
  response: ServerResponse,
  platformResponse: PlatformHttpResponse,
  body: string,
): void => {
  response.statusCode = platformResponse.status;
  applyPlatformResponseHeaders(response, platformResponse.headers);
  setDefaultSecurityHeaders(response);
  response.setHeader("Content-Length", Buffer.byteLength(body));
  response.end(body);
};
