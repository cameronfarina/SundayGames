import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import type { LiveDraftCommandImportFormat } from "../liveDraftSessionStore.js";
import { unknownField, unknownRecord } from "./unknownRecord.js";

export class RequestBodyTooLargeError extends Error {}
export class ScratchSessionsDisabledError extends Error {}

export const scratchSessionsDisabledBody = {
  error: {
    code: "scratch_sessions_disabled",
    message: "Scratch draft sessions are not available.",
  },
};

const contentLengthFor = (request: IncomingMessage): number | undefined => {
  const value = request.headers["content-length"];
  if (value === undefined || Array.isArray(value)) return undefined;
  const length = Number(value);
  return Number.isSafeInteger(length) && length >= 0 ? length : undefined;
};

export const positiveIntegerOption = (
  value: number | undefined,
  fallback: number,
  name: string,
): number => {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return resolved;
};

export const readRequestBody = async (
  request: IncomingMessage,
  maxBodyBytes: number,
): Promise<string> => new Promise((resolve, reject) => {
  if ((contentLengthFor(request) ?? 0) > maxBodyBytes) {
    request.pause();
    reject(new RequestBodyTooLargeError());
    return;
  }

  const chunks: Buffer[] = [];
  let byteLength = 0;
  const cleanup = (): void => {
    request.off("data", onData);
    request.off("end", onEnd);
    request.off("error", onError);
    request.off("aborted", onAborted);
  };
  const onData = (chunk: Buffer | string): void => {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    byteLength += buffer.byteLength;
    if (byteLength > maxBodyBytes) {
      request.pause();
      cleanup();
      reject(new RequestBodyTooLargeError());
      return;
    }
    chunks.push(buffer);
  };
  const onEnd = (): void => {
    cleanup();
    resolve(Buffer.concat(chunks, byteLength).toString("utf8"));
  };
  const onError = (error: Error): void => {
    cleanup();
    reject(error);
  };
  const onAborted = (): void => {
    cleanup();
    reject(new Error("Request body was aborted."));
  };

  request.on("data", onData);
  request.once("end", onEnd);
  request.once("error", onError);
  request.once("aborted", onAborted);
});

export const parseJsonBody = async (
  request: IncomingMessage,
  maxBodyBytes: number,
): Promise<Record<string, unknown>> => {
  const parsed: unknown = JSON.parse(await readRequestBody(request, maxBodyBytes) || "{}");
  const record = unknownRecord(parsed);
  if (!record) throw new Error("Request body must be a JSON object.");
  return record;
};

export const sendJson = (
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
): void => {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(body));
};

export const sendText = (
  response: ServerResponse,
  statusCode: number,
  contentType: string,
  body: string,
): void => {
  response.writeHead(statusCode, {
    "content-type": `${contentType}; charset=utf-8`,
    "cache-control": "no-store",
  });
  response.end(body);
};

export const importFormatFor = (value: unknown): LiveDraftCommandImportFormat => {
  if (value === "csv") return "csv";
  if (value === "json" || value === undefined) return "json";
  throw new Error("Import format must be json or csv.");
};

export const readTextFileIfPresent = async (path: string): Promise<string> => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && unknownField(error, "code") === "ENOENT") return "";
    throw error;
  }
};

export const readJsonFileIfPresent = async (path: string): Promise<unknown | null> => {
  const content = await readTextFileIfPresent(path);
  return content ? JSON.parse(content) : null;
};
