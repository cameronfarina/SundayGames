import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  detectEspnBrowserExtension,
  requestEspnBrowserCredentials,
} from "./espnBrowserExtensionApi";

const requestSchema = z.object({
  channel: z.string(),
  direction: z.literal("to-extension"),
  requestId: z.string(),
});

const respondToRequest = (
  responseFor: (request: Record<string, unknown>) => Record<string, unknown>,
) => {
  window.addEventListener("message", event => {
    const parsed = requestSchema.safeParse(event.data);
    if (!parsed.success) return;
    const request = parsed.data;
    window.dispatchEvent(new MessageEvent("message", {
      data: responseFor(request),
      origin: window.location.origin,
      source: window,
    }));
  }, { once: true });
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ESPN browser extension API", () => {
  it("detects an installed extension through a correlated response", async () => {
    respondToRequest(request => ({
      channel: request["channel"],
      direction: "to-page",
      requestId: request["requestId"],
      type: "status",
    }));

    await expect(detectEspnBrowserExtension()).resolves.toBe(true);
  });

  it("returns only a complete credential pair from the matching response", async () => {
    respondToRequest(request => ({
      channel: request["channel"],
      credentials: { espnS2: "session", swid: "{ACCOUNT-ID}" },
      direction: "to-page",
      requestId: request["requestId"],
      type: "credentials",
    }));

    await expect(requestEspnBrowserCredentials()).resolves.toEqual({
      espnS2: "session",
      swid: "{ACCOUNT-ID}",
    });
  });

  it("ignores a response from a different origin", async () => {
    vi.useFakeTimers();
    window.addEventListener("message", event => {
      const parsed = requestSchema.safeParse(event.data);
      if (!parsed.success) return;
      const request = parsed.data;
      window.dispatchEvent(new MessageEvent("message", {
        data: {
          channel: request.channel,
          direction: "to-page",
          requestId: request.requestId,
          type: "status",
        },
        origin: "https://attacker.example",
        source: window,
      }));
    }, { once: true });

    const detection = detectEspnBrowserExtension(50);
    await vi.advanceTimersByTimeAsync(50);
    await expect(detection).resolves.toBe(false);
  });

  it("stops waiting when the caller aborts", async () => {
    const controller = new AbortController();
    const credentials = requestEspnBrowserCredentials(controller.signal);
    controller.abort();

    await expect(credentials).rejects.toMatchObject({ code: "extension_unavailable" });
  });
});
