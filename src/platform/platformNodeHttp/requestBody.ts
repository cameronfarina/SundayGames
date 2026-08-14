import { Buffer } from "node:buffer";
import type { IncomingMessage } from "node:http";
import { InvalidJsonBodyError, RequestBodyTooLargeError } from "./errors.js";
import { contentLengthFor } from "./headers.js";

const parsedJson = (bodyText: string): unknown => {
  const value: unknown = JSON.parse(bodyText);
  return value;
};

export const readJsonBody = async (
  request: IncomingMessage,
  maxBodyBytes: number,
): Promise<unknown | undefined> => {
  const contentLength = contentLengthFor(request.headers);
  if (contentLength !== undefined && contentLength > maxBodyBytes) {
    request.resume();
    throw new RequestBodyTooLargeError();
  }

  const chunks: Buffer[] = [];
  let byteLength = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    byteLength += buffer.byteLength;
    if (byteLength > maxBodyBytes) {
      request.resume();
      throw new RequestBodyTooLargeError();
    }
    chunks.push(buffer);
  }

  if (byteLength === 0) return undefined;
  const bodyText = Buffer.concat(chunks, byteLength).toString("utf8");
  if (bodyText.trim().length === 0) return undefined;

  try {
    return parsedJson(bodyText);
  } catch {
    throw new InvalidJsonBodyError();
  }
};
