import type { IncomingHttpHeaders } from "node:http";

export class UnsupportedMediaTypeError extends Error {}

const jsonMutationMethods = new Set(["DELETE", "PATCH", "POST", "PUT"]);

const headerValue = (
  headers: IncomingHttpHeaders,
  name: string,
): string | undefined => {
  const value = headers[name];
  if (typeof value === "string") return value === "" ? undefined : value;
  return value?.find(candidate => candidate.length > 0);
};

const contentLengthFor = (headers: IncomingHttpHeaders): number | undefined => {
  const value = headerValue(headers, "content-length");
  if (value === undefined) return undefined;
  const length = Number(value);
  return Number.isFinite(length) && length >= 0 ? length : undefined;
};

const requestHasBody = (headers: IncomingHttpHeaders): boolean => {
  const contentLength = contentLengthFor(headers);
  return (contentLength !== undefined && contentLength > 0)
    || headerValue(headers, "transfer-encoding") !== undefined;
};

const isUtf8JsonContentType = (contentType: string | undefined): boolean => {
  if (contentType === undefined) return false;
  const [mediaType, ...parameters] = contentType.split(";");
  if (mediaType?.trim().toLowerCase() !== "application/json") return false;

  return parameters.every(parameter => {
    const separatorIndex = parameter.indexOf("=");
    if (separatorIndex === -1) return false;
    const name = parameter.slice(0, separatorIndex).trim().toLowerCase();
    const rawValue = parameter.slice(separatorIndex + 1).trim();
    const value = rawValue.startsWith("\"") && rawValue.endsWith("\"")
      ? rawValue.slice(1, -1)
      : rawValue;
    return name === "charset" && value.toLowerCase() === "utf-8";
  });
};

export const assertPlatformJsonMediaType = (
  method: string | undefined,
  headers: IncomingHttpHeaders,
): void => {
  if (!jsonMutationMethods.has(method?.toUpperCase() ?? "GET") || !requestHasBody(headers)) return;
  if (!isUtf8JsonContentType(headerValue(headers, "content-type"))) {
    throw new UnsupportedMediaTypeError();
  }
};
