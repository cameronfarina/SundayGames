import type { IncomingMessage } from "node:http";
import {
  brotliCompressSync,
  constants as zlibConstants,
  gzipSync,
} from "node:zlib";
import {
  dynamicGzipLevel,
  minimumCompressionBodyBytes,
  staticBrotliQuality,
} from "./constants.js";
import type { PreparedBrowserAsset } from "./contracts.js";
import { isCompressibleContentType } from "./compression.js";
import type { PlatformBrowserAsset } from "../platformStaticWebAssets.js";

export const prepareBrowserAssets = (
  browserAssets: ReadonlyMap<string, PlatformBrowserAsset> | undefined,
): ReadonlyMap<string, PreparedBrowserAsset> | undefined => {
  if (browserAssets === undefined) return undefined;

  const preparedAssets = new Map<string, PreparedBrowserAsset>();
  for (const [path, asset] of browserAssets) {
    if (asset.body.byteLength < minimumCompressionBodyBytes
      || !isCompressibleContentType(asset.contentType)) {
      preparedAssets.set(path, { source: asset });
      continue;
    }
    const brotli = brotliCompressSync(asset.body, {
      params: { [zlibConstants.BROTLI_PARAM_QUALITY]: staticBrotliQuality },
    });
    const gzipped = gzipSync(asset.body, { level: dynamicGzipLevel });
    preparedAssets.set(path, {
      source: asset,
      ...(brotli.byteLength < asset.body.byteLength ? { brotliBody: brotli } : {}),
      ...(gzipped.byteLength < asset.body.byteLength ? { gzipBody: gzipped } : {}),
    });
  }
  return preparedAssets;
};

export const browserAssetForRequest = (
  request: IncomingMessage,
  browserAssets: ReadonlyMap<string, PreparedBrowserAsset> | undefined,
): PreparedBrowserAsset | undefined => {
  if (request.method !== "GET" && request.method !== "HEAD") return undefined;
  try {
    const pathname = new URL(request.url ?? "/", "http://mockd.local").pathname;
    return browserAssets?.get(pathname);
  } catch {
    return undefined;
  }
};
