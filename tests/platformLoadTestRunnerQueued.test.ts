import { createServer, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { runPlatformLoadTest } from "../scripts/platformLoadTest/runner.js";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async server =>
    await new Promise<void>(resolve => server.close(() => resolve()))));
});

describe("platform mixed load queued simulation gate", () => {
  it("does not pass queued submissions until every worker job is terminal and successful", async () => {
    const streams = new Set<ServerResponse>();
    let simulationCount = 0;
    let jobReads = 0;
    const server = createServer((request, response) => {
      response.setHeader("Content-Type", "application/json");
      if (request.url?.endsWith("/event-stream") === true) {
        streams.add(response);
        response.on("close", () => streams.delete(response));
        response.setHeader("Content-Type", "text/event-stream");
        response.writeHead(200);
        response.write("event: room.snapshot\ndata: {\"roomId\":\"room\",\"revision\":1}\n\n");
        return;
      }
      request.resume();
      if (request.url === "/api/player-news") {
        response.writeHead(200).end(JSON.stringify({
          generatedAt: "2026-08-21T00:00:00.000Z",
          items: [], providers: [], sourceMode: "all",
          summary: {
            fadeCount: 0, filteredCount: 0, moveUpCount: 0,
            noChangeCount: 0, totalCount: 0, watchCount: 0,
          },
        }));
        return;
      }
      if (request.url === "/season-simulations") {
        simulationCount += 1;
        response.writeHead(202).end(JSON.stringify({
          historyId: `history-${String(simulationCount)}`,
          jobId: `job-${String(simulationCount)}`,
          status: "queued",
        }));
        return;
      }
      if (request.url?.startsWith("/jobs/") === true) {
        jobReads += 1;
        const jobId = request.url.split("/").at(-1);
        response.writeHead(200).end(JSON.stringify({ job: { id: jobId, status: "completed" } }));
        return;
      }
      for (const stream of streams) {
        stream.write("event: room.sale\ndata: {\"roomId\":\"room\",\"revision\":2}\n\n");
      }
      response.writeHead(200).end(JSON.stringify({ room: { roomId: "room", revision: 2 } }));
    });
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("Expected test port.");

    const report = await runPlatformLoadTest({
      baseUrl: new URL(`http://127.0.0.1:${String(address.port)}`),
      eventTimeoutMs: 100,
      holdMs: 0,
      jobPollIntervalMs: 1,
      jobTimeoutMs: 1_000,
      leagueCount: 1,
      manifest: {
        drafts: [{
          mutation: { action: "sales", body: {}, sessionToken: "draft-0" },
          roomId: "room",
          sessionTokens: Array.from({ length: 12 }, (_, index) => `draft-${index}`),
        }],
        newsSessionTokens: ["news"],
        simulationRequests: ["a", "b", "c"].map(value => ({
          body: { count: 1, seasonId: value }, sessionToken: `sim-${value}`,
        })),
      },
      mutationPaceMs: 0,
    });

    expect(report.passed).toBe(report.failures.length === 0);
    expect(report.failures.filter(failure => !failure.includes(" p95 "))).toEqual([]);
    expect(report.metadata.queuedSimulationJobs).toBe(25);
    expect(report.summaries.simulationCompletions).toMatchObject({ attempts: 25, errorRate: 0 });
    expect(report.summaries.simulationSubmissions.errorRate).toBe(0);
    expect(jobReads).toBe(25);
  });
});
