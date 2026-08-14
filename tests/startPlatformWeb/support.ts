import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";
import type { StartedPlatformWebProcess } from "../../src/platform/startPlatformWeb.js";

let startedProcess: StartedPlatformWebProcess | undefined;
let temporaryDirectory: string | undefined;

export const createTemporaryDirectory = async (): Promise<string> => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "mockd-platform-web-"));
  return temporaryDirectory;
};

export const trackStartedProcess = (
  process: StartedPlatformWebProcess,
): StartedPlatformWebProcess => {
  startedProcess = process;
  return process;
};

export const cleanupPlatformWebTest = async (): Promise<void> => {
  await startedProcess?.close();
  startedProcess = undefined;
  if (temporaryDirectory !== undefined) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = undefined;
  }
  vi.restoreAllMocks();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const recordValue = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error("Expected record value.");
  return value;
};

export const stringValue = (value: unknown): string => {
  if (typeof value !== "string") throw new Error("Expected string value.");
  return value;
};

export const sessionTokenFrom = (
  setCookie: string | readonly string[] | undefined,
): string => {
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const match = cookie?.match(/(?:^|;\s*)mockd_session=([^;]+)/);
  return stringValue(match?.[1]);
};
