import { createServer, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { runPlatformLoadTest } from "../scripts/platformLoadTest/runner.js";

const servers: ReturnType<typeof createServer>[] = [];
const newsBody = {
  generatedAt: "2026-08-21T00:00:00.000Z",
  items: [],
  providers: [],
  sourceMode: "all",
  summary: {
    fadeCount: 0, filteredCount: 0, moveUpCount: 0,
    noChangeCount: 0, totalCount: 0, watchCount: 0,
  },
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async server =>
    await new Promise<void>(resolve => server.close(() => resolve()))));
});

const manifest = {
  drafts: [{
    roomId: "room-1",
    sessionTokens: Array.from({ length: 12 }, (_, index) => `draft-${index}`),
    mutation: {
      action: "sales" as const,
      body: { expectedRevision: 1 },
      sessionToken: "draft-0",
    },
  }],
  newsSessionTokens: ["news"],
  simulationRequests: ["a", "b", "c"].map(suffix => ({
    body: { count: 1, seasonId: `season-${suffix}` },
    sessionToken: `sim-${suffix}`,
  })),
};

describe("platform mixed load runner", () => {
  it("reports mixed stream, reconnect, mutation, fanout, news, and simulation gates", async () => {
    const counts = { mutations: 0, news: 0, simulations: 0, streams: 0 };
    const streams = new Set<ServerResponse>();
    const server = createServer((request, response) => {
      if (request.url?.endsWith("/event-stream") === true) {
        counts.streams += 1;
        streams.add(response);
        response.on("close", () => streams.delete(response));
        response.writeHead(200, { "Content-Type": "text/event-stream" });
        response.write("event: room.snapshot\ndata: {\"roomId\":\"room-1\",\"revision\":1}\n\n");
        return;
      }
      request.resume();
      response.setHeader("Content-Type", "application/json");
      if (request.url === "/api/player-news") {
        counts.news += 1;
        response.writeHead(200).end(JSON.stringify(newsBody));
        return;
      }
      if (request.url === "/season-simulations") {
        counts.simulations += 1;
        response.writeHead(200).end(JSON.stringify({ historyId: "history", summary: {} }));
        return;
      }
      counts.mutations += 1;
      for (const stream of streams) {
        stream.write("event: room.sale\ndata: {\"roomId\":\"room-1\",\"revision\":2}\n\n");
      }
      response.writeHead(200).end(JSON.stringify({ room: { roomId: "room-1", revision: 2 } }));
    });
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("Expected test port.");

    const report = await runPlatformLoadTest({
      baseUrl: new URL(`http://127.0.0.1:${String(address.port)}/private?token=value`),
      eventTimeoutMs: 100,
      holdMs: 10,
      leagueCount: 1,
      manifest,
      mutationPaceMs: 0,
    });

    expect(report.passed).toBe(report.failures.length === 0);
    expect(report.failures.filter(failure => !failure.includes(" p95 "))).toEqual([]);
    expect(report.metadata).toMatchObject({
      holdMs: 10,
      scenario: { draftClients: 12, leagueCount: 1 },
      targetOrigin: `http://127.0.0.1:${String(address.port)}`,
    });
    expect(report.summaries.draftFanout.attempts).toBe(12);
    expect(report.summaries.draftFanout.errorRate).toBe(0);
    expect(report.summaries.draftMutations.attempts).toBe(1);
    expect(report.summaries.draftMutations.errorRate).toBe(0);
    expect(report.summaries.draftReconnects.attempts).toBe(1);
    expect(report.summaries.draftReconnects.errorRate).toBe(0);
    expect(report.summaries.draftStreams.errorRate).toBe(0);
    expect(report.summaries.news.errorRate).toBe(0);
    expect(report.summaries.simulationSubmissions.errorRate).toBe(0);
    expect(report.summaries.simulationCompletions).toBeNull();
    expect(counts).toEqual({ mutations: 1, news: 1_000, simulations: 25, streams: 13 });
  });
});
