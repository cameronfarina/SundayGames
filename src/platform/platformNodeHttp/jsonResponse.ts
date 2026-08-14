import { Buffer } from "node:buffer";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { PlatformHttpResponse } from "../platformHttp.js";
import { jsonContentType, minimumCompressionBodyBytes } from "./constants.js";
import { brotliBody, gzipBody, preferredContentEncoding, setVaryAcceptEncoding } from "./compression.js";
import { applyPlatformResponseHeaders } from "./responseHeaders.js";
import { setDefaultSecurityHeaders, setPrivateNoStoreCacheControl } from "./securityHeaders.js";

export const writeSerializedJsonResponse = async (
  request: IncomingMessage,
  response: ServerResponse,
  platformResponse: PlatformHttpResponse,
): Promise<void> => {
  const rawBody = Buffer.from(JSON.stringify(platformResponse.body ?? null));
  const shouldCompress = rawBody.byteLength >= minimumCompressionBodyBytes;
  const contentEncoding = shouldCompress
    ? preferredContentEncoding(request.headers)
    : undefined;
  const body = contentEncoding === "br"
    ? await brotliBody(rawBody)
    : contentEncoding === "gzip" ? await gzipBody(rawBody) : rawBody;

  response.statusCode = platformResponse.status;
  response.setHeader("Content-Type", jsonContentType);
  applyPlatformResponseHeaders(response, platformResponse.headers);
  setDefaultSecurityHeaders(response);
  setPrivateNoStoreCacheControl(response);
  if (shouldCompress) setVaryAcceptEncoding(response);
  if (contentEncoding !== undefined) response.setHeader("Content-Encoding", contentEncoding);
  response.setHeader("Content-Length", body.byteLength);
  response.end(body);
};
