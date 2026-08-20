import { createServer, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { runPlatformLoadTest } from "../scripts/platformLoadTest/runner.js";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async server =>
    await new Promise<void>(resolve => server.close(() => resolve()))));
});

describe("platform mixed load runtime stream gate", () => {
  it("fails when a connected client closes after successful mutation fanout", async () => {
    const streams = new Set<ServerResponse>();
    let roomRevision = 1;
    const server = createServer((request, response) => {
      if (request.url?.endsWith("/event-stream") === true) {
        streams.add(response);
        response.on("close", () => streams.delete(response));
        response.writeHead(200, { "Content-Type": "text/event-stream" });
        response.write(
          `event: room.snapshot\ndata: {"roomId":"room","revision":${String(roomRevision)}}\n\n`,
        );
        return;
      }
      request.resume();
      response.setHeader("Content-Type", "application/json");
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
        response.writeHead(200).end(JSON.stringify({ historyId: "history", summary: {} }));
        return;
      }
      roomRevision = 2;
      const streamToClose = [...streams].at(-1);
      for (const stream of streams) {
        stream.write("event: room.sale\ndata: {\"roomId\":\"room\",\"revision\":2}\n\n");
      }
      response.writeHead(200).end(JSON.stringify({ room: { roomId: "room", revision: 2 } }));
      setTimeout(() => streamToClose?.end(), 5);
    });
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("Expected test port.");

    const report = await runPlatformLoadTest({
      baseUrl: new URL(`http://127.0.0.1:${String(address.port)}`),
      eventTimeoutMs: 100,
      holdMs: 50,
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

    expect(report.passed).toBe(false);
    expect(report.failures).toContain("1 draft streams reported unexpected_close.");
  });
});
