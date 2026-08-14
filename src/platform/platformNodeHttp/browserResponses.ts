import { Buffer } from "node:buffer";
import type { IncomingMessage, ServerResponse } from "node:http";
import { htmlContentType } from "./constants.js";
import type { PreparedBrowserAsset } from "./contracts.js";
import { preferredContentEncoding, setVaryAcceptEncoding } from "./compression.js";
import { setDefaultSecurityHeaders, setHtmlSecurityHeaders } from "./securityHeaders.js";

export const writeHtmlResponse = (response: ServerResponse, html: string): void => {
  response.statusCode = 200;
  response.setHeader("Content-Type", htmlContentType);
  setHtmlSecurityHeaders(response);
  response.setHeader("Content-Length", Buffer.byteLength(html));
  response.end(html);
};

export const writeBrowserAssetResponse = (
  request: IncomingMessage,
  response: ServerResponse,
  asset: PreparedBrowserAsset,
): void => {
  const contentEncoding = preferredContentEncoding(request.headers);
  const body = contentEncoding === "br" && asset.brotliBody !== undefined
    ? asset.brotliBody
    : contentEncoding === "gzip" && asset.gzipBody !== undefined
      ? asset.gzipBody
      : asset.source.body;
  const selectedEncoding = body === asset.brotliBody
    ? "br"
    : body === asset.gzipBody ? "gzip" : undefined;

  response.statusCode = 200;
  response.setHeader("Cache-Control", asset.source.cacheControl);
  response.setHeader("Content-Type", asset.source.contentType);
  setDefaultSecurityHeaders(response);
  if (asset.brotliBody !== undefined || asset.gzipBody !== undefined) {
    setVaryAcceptEncoding(response);
  }
  if (selectedEncoding !== undefined) response.setHeader("Content-Encoding", selectedEncoding);
  response.setHeader("Content-Length", body.byteLength);
  response.end(request.method === "HEAD" ? undefined : body);
};

export const writeBrowserRedirectResponse = (
  response: ServerResponse,
  location: string,
): void => {
  setDefaultSecurityHeaders(response);
  response.writeHead(302, { "Content-Length": "0", Location: location });
  response.end();
};
