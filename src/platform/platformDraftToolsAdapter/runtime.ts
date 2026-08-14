import { resolve } from "node:path";
import {
  createLiveDraftServer,
  defaultLiveDraftImportBodyLimitBytes,
  defaultLiveDraftJsonBodyLimitBytes,
} from "../../liveDraftServer.js";
import { MockBatchResourceManager } from "../../mockBatchResourceManager.js";
import type { CreatePlatformDraftToolsAdapterOptions } from "./contracts.js";

export interface DraftToolsRuntime {
  baseSessionDirectory: string;
  createLiveDraftServer: NonNullable<
    CreatePlatformDraftToolsAdapterOptions["createLiveDraftServer"]
  >;
  idleTimeoutMs: number;
  importMaxBodyBytes: number;
  legacyMockBatchEnabled: boolean;
  maxBodyBytes: number;
  maxRetainedApps: number;
  mockBatchResourceManager: MockBatchResourceManager;
  now: () => number;
  options: CreatePlatformDraftToolsAdapterOptions;
}

const positiveInteger = (
  value: number | undefined,
  fallback: number,
  name: string,
): number => {
  const resolvedValue = value ?? fallback;
  if (!Number.isSafeInteger(resolvedValue) || resolvedValue <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return resolvedValue;
};

export const resolveDraftToolsRuntime = (
  options: CreatePlatformDraftToolsAdapterOptions,
): DraftToolsRuntime => ({
  baseSessionDirectory: resolve(options.baseSessionDirectory),
  createLiveDraftServer: options.createLiveDraftServer ?? createLiveDraftServer,
  idleTimeoutMs: positiveInteger(options.idleTimeoutMs, 30 * 60 * 1_000, "idleTimeoutMs"),
  importMaxBodyBytes: positiveInteger(
    options.importMaxBodyBytes,
    defaultLiveDraftImportBodyLimitBytes,
    "importMaxBodyBytes",
  ),
  legacyMockBatchEnabled: options.legacyMockBatchEnabled ?? false,
  maxBodyBytes: positiveInteger(
    options.maxBodyBytes,
    defaultLiveDraftJsonBodyLimitBytes,
    "maxBodyBytes",
  ),
  maxRetainedApps: positiveInteger(options.maxRetainedApps, 32, "maxRetainedApps"),
  mockBatchResourceManager: new MockBatchResourceManager(options.mockBatchResourceLimits),
  now: options.now ?? Date.now,
  options,
});
