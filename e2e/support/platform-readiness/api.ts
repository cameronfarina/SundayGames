import { expect, type Page } from "@playwright/test";
import type { JsonResponse } from "./types.js";

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
}

interface ApiRequest {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  body: unknown;
  headers: Record<string, string> | undefined;
}

export const expectOk = <TBody>(response: JsonResponse<TBody>): TBody => {
  const responseBody = JSON.stringify(response.body);
  expect(response.status, responseBody).toBeGreaterThanOrEqual(200);
  expect(response.status, responseBody).toBeLessThan(300);

  return response.body;
};

export const api = async <TBody>(
  page: Page,
  path: string,
  options: ApiOptions = {},
): Promise<JsonResponse<TBody>> =>
  await page.evaluate<JsonResponse<TBody>, ApiRequest>(async ({
    path: requestPath,
    method,
    body,
    headers,
  }) => {
    const init: RequestInit = {
      credentials: "same-origin",
      ...(method === undefined ? {} : { method }),
      ...(headers === undefined ? {} : { headers }),
    };
    if (body !== undefined) {
      init.headers = { ...headers, "content-type": "application/json" };
      init.body = JSON.stringify(body);
    }
    const response = await fetch(requestPath, init);
    const text = await response.text();

    return {
      status: response.status,
      body: text.length === 0 ? null : JSON.parse(text),
    };
  }, {
    path,
    method: options.method ?? "GET",
    body: options.body,
    headers: options.headers,
  });
