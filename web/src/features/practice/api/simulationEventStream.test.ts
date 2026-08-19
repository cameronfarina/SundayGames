import { describe, expect, it, vi } from "vitest";
import type { PlatformApiError } from "../../../shared/api/http/PlatformApiError";
import {
  consumeSimulationStream,
  SimulationQueueApiError,
} from "./simulationEventStream";

const summary = {
  completedCount: 1,
  draftFormat: "auction",
  outcomes: [],
  playerExposure: [],
  preferenceOutcomes: [{
    feasible: true,
    hitCount: 1,
    hitRate: 1,
    message: "Elite RB preference hit in 1/1 runs.",
    position: "RB",
    rule: {
      basis: "auction_expected_value",
      minimumExpectedValue: 52,
      positionRankMaximum: 4,
      qualifyingPlayerIds: ["jahmyr gibbs"],
    },
    status: "hit",
    targetCount: 1,
    tier: "elite",
  }],
  positionCounts: {},
  runCount: 1,
  seedPrefix: "stream-test",
  strategy: {
    preferredPositions: [{ position: "RB", tier: "elite" }],
    rawInput: "Target an elite RB",
    summary: "Prioritize elite RB.",
    warnings: [],
  },
};

const chunkedResponse = (...chunks: string[]): Response => {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach(chunk => { controller.enqueue(encoder.encode(chunk)); });
      controller.close();
    },
  }));
};

describe("simulation event stream", () => {
  it("reassembles split events and ignores unrelated events", async () => {
    const onProgress = vi.fn();
    const result = { historyId: "history-1", summary };
    const response = chunkedResponse(
      "event: heartbeat\ndata: {}\n\nevent: progress\ndata: {\"completed\":",
      "1,\"total\":1}\n\nevent: result\ndata: ",
      `${JSON.stringify(result)}\n\n`,
    );

    await expect(consumeSimulationStream(response, { onProgress })).resolves.toEqual(result);
    expect(onProgress).toHaveBeenCalledWith({ completed: 1, total: 1 });
  });

  it("surfaces typed simulation failures", async () => {
    const response = chunkedResponse(
      'event: error\ndata: {"error":{"code":"simulation_timeout","message":"Stopped."}}\n\n',
    );
    await expect(consumeSimulationStream(response, { onProgress: vi.fn() }))
      .rejects.toEqual(expect.objectContaining<Partial<PlatformApiError>>({
        code: "simulation_timeout",
        message: "Stopped.",
      }));
  });

  it("surfaces per-account queue denials as retryable typed errors", async () => {
    const response = chunkedResponse(
      'event: error\ndata: {"error":{"code":"simulation_account_queue_full","message":"Try shortly."}}\n\n',
    );

    await expect(consumeSimulationStream(response, { onProgress: vi.fn() }))
      .rejects.toEqual(new SimulationQueueApiError({
        code: "simulation_account_queue_full",
        message: "Try shortly.",
        retryAfterSeconds: 5,
      }));
  });

  it("rejects progress beyond the declared total", async () => {
    const result = { historyId: "history-1", summary };
    const response = chunkedResponse(
      'event: progress\ndata: {"completed":2,"total":1}\n\n',
      `event: result\ndata: ${JSON.stringify(result)}\n\n`,
    );
    await expect(consumeSimulationStream(response, { onProgress: vi.fn() }))
      .rejects.toEqual(expect.objectContaining<Partial<PlatformApiError>>({ code: "invalid_response" }));
  });

  it.each([
    ["invalid JSON", "event: progress\ndata: nope\n\n"],
    ["invalid progress", 'event: progress\ndata: {"completed":2,"total":0}\n\n'],
    ["invalid error", "event: error\ndata: {}\n\n"],
    ["missing result", "not-an-event\n\n"],
  ])("rejects %s", async (_label, stream) => {
    await expect(consumeSimulationStream(chunkedResponse(stream), { onProgress: vi.fn() }))
      .rejects.toEqual(expect.objectContaining<Partial<PlatformApiError>>({ code: "invalid_response" }));
  });

  it("names the field that broke when a stream event fails its schema", async () => {
    const response = chunkedResponse('event: progress\ndata: {"completed":0,"total":0}\n\n');

    await expect(consumeSimulationStream(response, { onProgress: vi.fn() }))
      .rejects.toMatchObject({
        body: { completed: 0, total: 0 },
        code: "invalid_response",
        issues: [{ path: "total" }],
      });
  });

  it("names what broke when an error event misses the error contract", async () => {
    const response = chunkedResponse("event: error\ndata: {}\n\n");

    await expect(consumeSimulationStream(response, { onProgress: vi.fn() }))
      .rejects.toMatchObject({
        body: {},
        code: "invalid_response",
        issues: [{ path: "error" }],
      });
  });

  it("carries no issues where there is no schema to fail", async () => {
    await expect(consumeSimulationStream(new Response(null), { onProgress: vi.fn() }))
      .rejects.toMatchObject({ code: "invalid_response", issues: [] });
  });

  it("rejects a response without a body", async () => {
    await expect(consumeSimulationStream(new Response(null), { onProgress: vi.fn() }))
      .rejects.toEqual(expect.objectContaining<Partial<PlatformApiError>>({ code: "invalid_response" }));
  });
});
