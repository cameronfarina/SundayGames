import type { Buffer } from "node:buffer";
import type { PlatformHttpRequest, PlatformHttpResponse } from "../platformHttp.js";
import type { PlatformBrowserAsset } from "../platformStaticWebAssets.js";

export interface ActivePlatformHttpStreamRegistry {
  run(input: { abort: () => void; write: () => Promise<void> }): Promise<void>;
}

export interface PlatformNodeHttpAdapterOptions {
  appHtml?: string | undefined;
  browserAssets?: ReadonlyMap<string, PlatformBrowserAsset> | undefined;
  maxBodyBytes?: number | undefined;
  screenshotImportMaxBodyBytes?: number | undefined;
  screenshotImportPreflight?: PlatformNodeHttpPreflight | undefined;
  historicalImportPreflight?: PlatformNodeHttpAdmission | undefined;
  trustProxy?: boolean | undefined;
  activeStreamRegistry?: ActivePlatformHttpStreamRegistry | undefined;
}

export type PlatformNodeHttpPreflight = (
  request: PlatformHttpRequest,
) => Promise<PlatformHttpResponse | null>;

export interface PlatformNodeHttpAdmissionPermit {
  release(): void;
}

export type PlatformNodeHttpAdmission = (
  request: PlatformHttpRequest,
) => Promise<PlatformHttpResponse | PlatformNodeHttpAdmissionPermit>;

export interface PlatformNodeHttpLogEntry {
  timestamp: string;
  level: "info" | "error";
  event: "http_request_completed" | "http_request_error";
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
}

export interface ObservePlatformNodeHttpServerOptions {
  logger?: ((entry: PlatformNodeHttpLogEntry) => void) | undefined;
}

export interface PreparedBrowserAsset {
  readonly brotliBody?: Buffer | undefined;
  readonly gzipBody?: Buffer | undefined;
  readonly source: PlatformBrowserAsset;
}

export type ContentEncoding = "br" | "gzip";
