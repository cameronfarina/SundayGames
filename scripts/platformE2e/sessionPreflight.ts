import {
  defaultDeployedPreflightTimeoutMs,
  type PlatformE2eFetch,
} from "./contracts.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const bodySnippet = (text: string): string => {
  const compact = text.replace(/\s+/gu, " ").trim();
  if (compact.length === 0) return "empty body";
  return compact.length > 180 ? `${compact.slice(0, 180)}...` : compact;
};

const parseJsonBody = (
  text: string,
  sessionUrl: URL,
  status: number,
  contentType: string,
): unknown => {
  if (text.trim().length === 0) return {};
  try {
    const body: unknown = JSON.parse(text);
    return body;
  } catch {
    throw new Error(
      `Expected ${sessionUrl.toString()} to return Mockd /session JSON. `
      + `Received HTTP ${String(status)} ${contentType}: ${bodySnippet(text)}. `
      + "The response had a JSON content type but was not parseable JSON.",
    );
  }
};

export const verifyDeployedPlatformSessionRoute = async (
  baseUrl: string,
  fetchSession: PlatformE2eFetch = fetch,
  timeoutMs = defaultDeployedPreflightTimeoutMs,
): Promise<void> => {
  const sessionUrl = new URL("/session", baseUrl);
  let response: Response;
  try {
    response = await fetchSession(sessionUrl, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not reach deployed Mockd /session at ${sessionUrl.toString()}: ${message}. `
      + "Check the base URL and confirm the deployment is reachable from this machine.",
    );
  }
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  const body = contentType.toLowerCase().includes("application/json")
    ? parseJsonBody(text, sessionUrl, response.status, contentType)
    : undefined;
  const error = isRecord(body) ? body["error"] : undefined;
  const errorCode = isRecord(error) ? error["code"] : undefined;
  if (response.status === 401 && errorCode === "auth_required") return;
  if (response.status === 200 && isRecord(body) && isRecord(body["account"])) return;
  throw new Error(
    `Expected ${sessionUrl.toString()} to return Mockd /session JSON. `
    + `Received HTTP ${String(response.status)} ${contentType || "without content-type"}: `
    + `${bodySnippet(text)}. Check that the base URL points at Mockd.`,
  );
};
