import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import {
  abandonMock,
  createMock,
  loadMock,
  sendMockCommand,
} from "./mockDraftApi.js";
import { auctionMockResponseFixture } from "../test/auctionMockResponseFixture.js";
import { auctionCommandSchema } from "./auctionStateSchemas.js";

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  headers: { "content-type": "application/json" },
  status,
});

describe("mock draft API", () => {
  it("creates and resumes auction mocks through the season endpoints", async () => {
    const body = auctionMockResponseFixture();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(body, 201))
      .mockResolvedValueOnce(jsonResponse(body));

    await expect(createMock({ seasonId: "season 1", strategy: "balanced" }, fetcher))
      .resolves.toEqual(body);
    await expect(loadMock({ seasonId: "season 1", sessionId: "mock 1" }, fetcher))
      .resolves.toEqual(body);
    expect(fetcher).toHaveBeenNthCalledWith(1, "/season-mock-drafts", expect.objectContaining({
      body: JSON.stringify({ seasonId: "season 1", strategy: "balanced" }),
      method: "POST",
    }));
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "/season-mock-drafts/mock%201?seasonId=season%201",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("sends revisioned commands with a unique id", async () => {
    const body = auctionMockResponseFixture();
    let path = "";
    let method: string | undefined;
    let requestBody = "";
    const fetcher: PlatformFetch = (input, init) => {
      path = typeof input === "string"
        ? input
        : input instanceof URL ? input.toString() : input.url;
      method = init?.method;
      requestBody = typeof init?.body === "string" ? init.body : "";
      return Promise.resolve(jsonResponse(body));
    };

    await sendMockCommand({
      command: { type: "buy", expectedRevision: 3, price: 42 },
      seasonId: "season-1",
      sessionId: "mock-1",
    }, fetcher);

    expect(path).toBe("/season-mock-drafts/mock-1/commands");
    expect(method).toBe("POST");
    const unknownBody: unknown = JSON.parse(requestBody);
    const parsed = z.object({
      command: auctionCommandSchema,
      commandId: z.string(),
      seasonId: z.string(),
    }).parse(unknownBody);
    expect(parsed.command).toEqual({ type: "buy", expectedRevision: 3, price: 42 });
    expect(parsed.commandId).toMatch(/^buy:/u);
    expect(parsed.seasonId).toBe("season-1");
  });

  it("abandons a writable session and rejects malformed success bodies", async () => {
    const body = auctionMockResponseFixture();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ mockSession: { ...body.mockSession, status: "abandoned" } }))
      .mockResolvedValueOnce(jsonResponse({ state: "broken" }));

    await expect(abandonMock({
      expectedRevision: 3,
      seasonId: "season-1",
      sessionId: "mock-1",
    }, fetcher)).resolves.toMatchObject({ mockSession: { status: "abandoned" } });
    await expect(loadMock({ seasonId: "season-1", sessionId: "mock-1" }, fetcher))
      .rejects.toMatchObject({ code: "invalid_response" });
  });
});
