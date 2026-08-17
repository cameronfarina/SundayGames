import type { output, ZodType } from "zod";
import { PlatformApiError } from "./PlatformApiError";
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
    throw new PlatformApiError({
      code: "invalid_response",
      message: "The server returned data that does not match the application contract.",
      status: response.status,
    });
  }

  return parsed.data;
};
