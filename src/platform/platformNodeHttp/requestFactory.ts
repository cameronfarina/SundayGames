import type { IncomingMessage } from "node:http";
import type { PlatformHttpRequest } from "../platformHttp.js";
import { platformHeadersFor } from "./headers.js";
import { clientAddressFor, isSecureRequest } from "./proxyTrust.js";
import { readJsonBody } from "./requestBody.js";
import { platformSessionTokenForHeaders } from "./sessionTokens.js";

export const platformRequestMetadataFor = (
  request: IncomingMessage,
  trustProxy: boolean,
  signal?: AbortSignal,
): PlatformHttpRequest => {
  const sessionToken = platformSessionTokenForHeaders(request.headers);
  return {
    method: request.method ?? "GET",
    path: request.url ?? "/",
    sessionToken,
    headers: platformHeadersFor(request.headers),
    isSecure: isSecureRequest(request, trustProxy),
    clientAddress: clientAddressFor(request, trustProxy),
    ...(signal === undefined ? {} : { signal }),
  };
};

export const platformRequestFor = async (
  request: IncomingMessage,
  maxBodyBytes: number,
  trustProxy: boolean,
  signal?: AbortSignal,
): Promise<PlatformHttpRequest> => ({
  ...platformRequestMetadataFor(request, trustProxy, signal),
  body: await readJsonBody(request, maxBodyBytes),
});
