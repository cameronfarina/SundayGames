import { Buffer } from "node:buffer";
import type { IncomingHttpHeaders, ServerResponse } from "node:http";
import {
  brotliCompress,
  constants as zlibConstants,
  gzip,
} from "node:zlib";
import {
  dynamicBrotliQuality,
  dynamicGzipLevel,
} from "./constants.js";
import type { ContentEncoding } from "./contracts.js";
import { headerValue } from "./headers.js";

const encodingQuality = (value: string): number => {
  const qualityParameter = value.split(";").slice(1).map(parameter => parameter.trim())
    .find(parameter => parameter.toLowerCase().startsWith("q="));
  if (qualityParameter === undefined) return 1;
  const quality = Number(qualityParameter.slice(2));
  return Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0;
};

export const preferredContentEncoding = (
  headers: IncomingHttpHeaders,
): ContentEncoding | undefined => {
  const acceptEncoding = headerValue(headers, "accept-encoding");
  if (acceptEncoding === undefined) return undefined;

  const qualities = new Map<string, number>();
  for (const value of acceptEncoding.split(",")) {
    const name = value.trim().split(";", 1)[0]?.toLowerCase();
    if (name !== undefined && name !== "") qualities.set(name, encodingQuality(value));
  }
  const wildcardQuality = qualities.get("*") ?? 0;
  const brotliQuality = qualities.get("br") ?? wildcardQuality;
  const gzipQuality = qualities.get("gzip") ?? wildcardQuality;
  const identityQuality = qualities.get("identity");
  if (brotliQuality <= 0 && gzipQuality <= 0) return undefined;
  if (identityQuality !== undefined && identityQuality > Math.max(brotliQuality, gzipQuality)) {
    return undefined;
  }
  return brotliQuality >= gzipQuality ? "br" : "gzip";
};

export const brotliBody = async (body: Buffer): Promise<Buffer> => await new Promise(
  (resolve, reject) => {
    brotliCompress(body, {
      params: { [zlibConstants.BROTLI_PARAM_QUALITY]: dynamicBrotliQuality },
    }, (error, compressedBody) => {
      if (error === null) resolve(compressedBody);
      else reject(error);
    });
  },
);

export const gzipBody = async (body: Buffer): Promise<Buffer> => await new Promise(
  (resolve, reject) => {
    gzip(body, { level: dynamicGzipLevel }, (error, compressedBody) => {
      if (error === null) resolve(compressedBody);
      else reject(error);
    });
  },
);

export const setVaryAcceptEncoding = (response: ServerResponse): void => {
  const existingVary = response.getHeader("Vary");
  const values = Array.isArray(existingVary)
    ? existingVary
    : typeof existingVary === "string" ? existingVary.split(",") : [];
  if (!values.some(value => value.trim().toLowerCase() === "accept-encoding")) {
    response.setHeader("Vary", [...values, "Accept-Encoding"]);
  }
};

export const isCompressibleContentType = (contentType: string): boolean => {
  const mimeType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return mimeType.startsWith("text/")
    || mimeType === "application/javascript"
    || mimeType === "application/json"
    || mimeType === "application/manifest+json"
    || mimeType === "application/xml"
    || mimeType.endsWith("+json")
    || mimeType.endsWith("+xml")
    || mimeType === "image/svg+xml";
};
