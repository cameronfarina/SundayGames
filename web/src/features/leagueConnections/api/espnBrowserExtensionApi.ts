import { z } from "zod";
import type { ConnectionCredentials } from "./leagueConnectionsApi";

const channel = "sunday-games-espn-connector-v1";
const defaultTimeoutMs = 750;
const credentialTimeoutMs = 5_000;

const statusResponseSchema = z.object({
  channel: z.literal(channel),
  direction: z.literal("to-page"),
  requestId: z.string(),
  type: z.literal("status"),
});

const credentialResponseSchema = z.discriminatedUnion("type", [
  z.object({
    channel: z.literal(channel),
    credentials: z.object({ espnS2: z.string().min(1), swid: z.string().min(1) }),
    direction: z.literal("to-page"),
    requestId: z.string(),
    type: z.literal("credentials"),
  }),
  z.object({
    channel: z.literal(channel),
    code: z.enum(["not_signed_in", "read_failed"]),
    direction: z.literal("to-page"),
    requestId: z.string(),
    type: z.literal("error"),
  }),
]);

type ExtensionRequestType = "read-credentials" | "status";

const receiveResponse = <T extends { readonly requestId: string }>(
  requestType: ExtensionRequestType,
  parse: (value: unknown) => T | undefined,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T | undefined> => new Promise(resolve => {
  const requestId = crypto.randomUUID();
  let timeout = 0;
  const finish = (response: T | undefined): void => {
    window.clearTimeout(timeout);
    window.removeEventListener("message", onMessage);
    signal?.removeEventListener("abort", onAbort);
    resolve(response);
  };
  function onMessage(event: MessageEvent<unknown>): void {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const parsed = parse(event.data);
    if (parsed?.requestId !== requestId) return;
    finish(parsed);
  }
  function onAbort(): void { finish(undefined); }
  timeout = window.setTimeout(() => { finish(undefined); }, timeoutMs);
  window.addEventListener("message", onMessage);
  if (signal?.aborted === true) {
    finish(undefined);
    return;
  }
  signal?.addEventListener("abort", onAbort, { once: true });
  window.postMessage({
    channel,
    direction: "to-extension",
    requestId,
    type: requestType,
  }, window.location.origin);
});

export const detectEspnBrowserExtension = async (
  timeoutMs = defaultTimeoutMs,
): Promise<boolean> => {
  const response = await receiveResponse("status", value => {
    const parsed = statusResponseSchema.safeParse(value);
    return parsed.success ? parsed.data : undefined;
  }, timeoutMs);
  return response !== undefined;
};

export class EspnBrowserExtensionError extends Error {
  public readonly code: "extension_unavailable" | "not_signed_in" | "read_failed";

  public constructor(code: "extension_unavailable" | "not_signed_in" | "read_failed") {
    super(code);
    this.code = code;
    this.name = "EspnBrowserExtensionError";
  }
}

export const requestEspnBrowserCredentials = async (
  signal?: AbortSignal,
): Promise<ConnectionCredentials> => {
  const response = await receiveResponse("read-credentials", value => {
    const parsed = credentialResponseSchema.safeParse(value);
    return parsed.success ? parsed.data : undefined;
  }, credentialTimeoutMs, signal);
  if (response === undefined) throw new EspnBrowserExtensionError("extension_unavailable");
  if (response.type === "error") throw new EspnBrowserExtensionError(response.code);
  return response.credentials;
};
