import type { output, ZodError, ZodType } from "zod";
import { PlatformApiError, type PlatformApiErrorIssue } from "./PlatformApiError";
import { platformErrorSchema } from "./platformErrorSchema";

export type PlatformFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

interface RequestPlatformJsonOptions<Schema extends ZodType> {
  readonly fetcher?: PlatformFetch;
  readonly init?: RequestInit;
  readonly path: string;
  readonly responseSchema: Schema;
}

const responseBody = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

const apiErrorFor = (status: number, body: unknown): PlatformApiError => {
  const parsed = platformErrorSchema.safeParse(body);
  if (parsed.success) {
    return new PlatformApiError({
      body,
      code: parsed.data.error.code,
      message: parsed.data.error.message,
      status,
    });
  }

  return new PlatformApiError({
    code: "invalid_error_response",
    message: "The server returned an unreadable error response.",
    status,
  });
};

/**
 * A path segment can be a symbol, which String() renders and an implicit
 * conversion would throw on. This runs while an error is already being built,
 * so it takes the explicit call rather than risk throwing over the failure it
 * is trying to describe.
 */
const issuePath = (segments: readonly PropertyKey[]): string =>
  segments.map(segment => String(segment)).join(".");

const contractIssues = (error: ZodError): readonly PlatformApiErrorIssue[] =>
  error.issues.map(issue => ({ message: issue.message, path: issuePath(issue.path) }));

export const requestPlatformJson = async <Schema extends ZodType>(
  options: RequestPlatformJsonOptions<Schema>,
): Promise<output<Schema>> => {
  const headers = new Headers(options.init?.headers);
  headers.set("Accept", "application/json");
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(options.path, {
    ...options.init,
    credentials: "same-origin",
    headers,
  });
  const body = await responseBody(response);
  if (!response.ok) throw apiErrorFor(response.status, body);

  const parsed = options.responseSchema.safeParse(body);
  if (!parsed.success) {
    // The message stays the one a person should read. What the payload actually
    // got wrong rides alongside it, because a contract break with no field name
    // attached is a failure nobody can diagnose from a report.
    throw new PlatformApiError({
      body,
      code: "invalid_response",
      issues: contractIssues(parsed.error),
      message: "The server returned data that does not match the application contract.",
      status: response.status,
    });
  }

  return parsed.data;
};
