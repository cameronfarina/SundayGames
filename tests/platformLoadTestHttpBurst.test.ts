import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { runAuthenticatedHttpBurst } from "../scripts/platformLoadTest/httpBurst.js";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async server =>
    await new Promise<void>(resolve => server.close(() => resolve()))));
});

describe("platform authenticated HTTP load", () => {
  it("refuses redirects before a session token can reach another origin", async () => {
    const leakedTokens: string[] = [];
    const sink = createServer((request, response) => {
      if (typeof request.headers["x-session-token"] === "string") {
        leakedTokens.push(request.headers["x-session-token"]);
      }
      response.writeHead(200).end("{}");
    });
    servers.push(sink);
    await new Promise<void>(resolve => sink.listen(0, "127.0.0.1", resolve));
    const sinkAddress = sink.address();
    if (typeof sinkAddress !== "object" || sinkAddress === null) throw new Error("Expected sink port.");

    const redirector = createServer((_request, response) => {
      response.writeHead(302, {
        Location: `http://127.0.0.1:${String(sinkAddress.port)}/collect`,
      }).end();
    });
    servers.push(redirector);
    await new Promise<void>(resolve => redirector.listen(0, "127.0.0.1", resolve));
    const redirectAddress = redirector.address();
    if (typeof redirectAddress !== "object" || redirectAddress === null) {
      throw new Error("Expected redirect port.");
    }

    const [measurement] = await runAuthenticatedHttpBurst(
      new URL(`http://127.0.0.1:${String(redirectAddress.port)}`),
      [{ method: "GET", path: "/redirect", responseKind: "player-news", sessionToken: "must-not-leak" }],
    );

    expect(measurement?.ok).toBe(false);
    expect(leakedTokens).toEqual([]);
  });

  it("accepts the player-news JSON contract and rejects a generic successful response", async () => {
    const received: Array<{ body: string; path: string; token?: string }> = [];
    const server = createServer((request, response) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", chunk => { body += chunk; });
      request.on("end", () => {
        received.push({
          body,
          path: request.url ?? "",
          ...(typeof request.headers["x-session-token"] === "string"
            ? { token: request.headers["x-session-token"] } : {}),
        });
        if (request.url === "/news") {
          response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
            generatedAt: "2026-08-21T00:00:00.000Z",
            items: [],
            providers: [],
            sourceMode: "all",
            summary: {
              fadeCount: 0,
              filteredCount: 0,
              moveUpCount: 0,
              noChangeCount: 0,
              totalCount: 0,
              watchCount: 0,
            },
          }));
          return;
        }
        response.writeHead(200, { "Content-Type": "text/html" }).end("<html></html>");
      });
    });
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("Expected test port.");

    const measurements = await runAuthenticatedHttpBurst(
      new URL(`http://127.0.0.1:${String(address.port)}`),
      [
        { method: "GET", path: "/news", responseKind: "player-news", sessionToken: "secret-1" },
        { method: "GET", path: "/not-news", responseKind: "player-news", sessionToken: "secret-2" },
      ],
    );

    expect(measurements).toHaveLength(2);
    expect(measurements.map(measurement => measurement.ok)).toEqual([true, false]);
    expect(measurements.map(measurement => measurement.diagnostic))
      .toEqual(["ok", "unexpected_content_type"]);
    expect(received.sort((left, right) => left.path.localeCompare(right.path))).toEqual([
      { body: "", path: "/news", token: "secret-1" },
      { body: "", path: "/not-news", token: "secret-2" },
    ]);
  });

  it("accepts only issued browser simulation inputs with the exact contract", async () => {
    const server = createServer((request, response) => {
      request.resume();
      response.setHeader("Content-Type", "application/json");
      if (request.url === "/issued") {
        response.writeHead(202).end(JSON.stringify({
          historyId: "history-issued",
          requestId: "request-1",
          input: { runCount: 1 },
          inputDigest: "digest-1",
        }));
        return;
      }
      response.writeHead(202).end(JSON.stringify({ historyId: "history" }));
    });
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("Expected test port.");

    const measurements = await runAuthenticatedHttpBurst(
      new URL(`http://127.0.0.1:${String(address.port)}`),
      ["issued", "bad"].map(path => ({
        body: { count: 1 },
        method: "POST" as const,
        path: `/${path}`,
        responseKind: "season-simulation" as const,
        sessionToken: `session-${path}`,
      })),
    );

    expect(measurements.map(measurement => measurement.diagnostic)).toEqual([
      "ok",
      "invalid_simulation_response",
    ]);
    expect(measurements.map(measurement => measurement.ok)).toEqual([true, false]);
    expect(measurements[0]?.issuedSimulationLaunch).toEqual({
      historyId: "history-issued",
      sessionToken: "session-issued",
    });
  });

  it("captures the exact revision from a valid live-room mutation response", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
        room: { roomId: "room-1", revision: 8 },
      }));
    });
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("Expected test port.");

    const [measurement] = await runAuthenticatedHttpBurst(
      new URL(`http://127.0.0.1:${String(address.port)}`),
      [{
        body: { expectedRevision: 7 },
        method: "POST",
        path: "/live-rooms/room-1/sales",
        responseKind: "live-room-mutation",
        roomId: "room-1",
        sessionToken: "session",
      }],
    );

    expect(measurement).toMatchObject({ diagnostic: "ok", ok: true, roomRevision: 8, status: 200 });
  });

  it("captures a matching terminal job response", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
        job: { id: "job-1", status: "completed" },
      }));
    });
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("Expected test port.");

    const [measurement] = await runAuthenticatedHttpBurst(
      new URL(`http://127.0.0.1:${String(address.port)}`),
      [{
        jobId: "job-1",
        method: "GET",
        path: "/jobs/job-1",
        responseKind: "job",
        sessionToken: "session",
      }],
    );

    expect(measurement).toMatchObject({ diagnostic: "ok", jobStatus: "completed", ok: true });
  });
});
