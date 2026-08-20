import { createServer, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { openDraftStreamBatch } from "../scripts/platformLoadTest/draftStreams.js";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async server =>
    await new Promise<void>(resolve => server.close(() => resolve()))));
});

describe("platform live-draft stream load", () => {
  it("refuses redirects before a draft session token can reach another origin", async () => {
    const leakedTokens: string[] = [];
    const sink = createServer((request, response) => {
      if (typeof request.headers["x-session-token"] === "string") {
        leakedTokens.push(request.headers["x-session-token"]);
      }
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.write("event: room.snapshot\ndata: {\"roomId\":\"room\",\"revision\":1}\n\n");
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

    const batch = await openDraftStreamBatch({
      baseUrl: new URL(`http://127.0.0.1:${String(redirectAddress.port)}`),
      clients: [{ roomId: "room", sessionToken: "must-not-leak" }],
    });

    expect(batch.measurements[0]?.ok).toBe(false);
    expect(leakedTokens).toEqual([]);
    await batch.close();
  });

  it("opens authenticated streams through their initial snapshots and closes them", async () => {
    const requests: { path: string; token: string | undefined }[] = [];
    const server = createServer((request, response) => {
      requests.push({
        path: request.url ?? "",
        token: typeof request.headers["x-session-token"] === "string"
          ? request.headers["x-session-token"] : undefined,
      });
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      const roomId = decodeURIComponent(request.url?.split("/")[2] ?? "");
      response.write(`event: room.snapshot\ndata: {"roomId":"${roomId}","revision":1}\n\n`);
    });
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("Expected test port.");

    const batch = await openDraftStreamBatch({
      baseUrl: new URL(`http://127.0.0.1:${String(address.port)}`),
      clients: [
        { roomId: "room one", sessionToken: "session-1" },
        { roomId: "room-two", sessionToken: "session-2" },
      ],
    });

    expect(batch.measurements).toHaveLength(2);
    expect(batch.measurements.every(measurement => measurement.ok)).toBe(true);
    expect(requests).toEqual([
      { path: "/live-rooms/room%20one/event-stream", token: "session-1" },
      { path: "/live-rooms/room-two/event-stream", token: "session-2" },
    ]);
    expect(batch.unexpectedClosureCount()).toBe(0);
    await batch.close();
  });

  it("reports a stream that closes after its initial snapshot", async () => {
    const server = createServer((request, response) => {
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      const roomId = request.url?.split("/")[2] ?? "";
      response.end(`event: room.snapshot\ndata: {"roomId":"${roomId}","revision":1}\n\n`);
    });
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("Expected test port.");

    const batch = await openDraftStreamBatch({
      baseUrl: new URL(`http://127.0.0.1:${String(address.port)}`),
      clients: [{ roomId: "closing-room", sessionToken: "session" }],
    });
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(batch.unexpectedClosureCount()).toBe(1);
    await batch.close();
  });

  it("rejects a non-SSE success body containing the snapshot text", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ message: "event: room.snapshot" }));
    });
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("Expected test port.");

    const batch = await openDraftStreamBatch({
      baseUrl: new URL(`http://127.0.0.1:${String(address.port)}`),
      clients: [{ roomId: "room", sessionToken: "session" }],
    });

    expect(batch.measurements[0]).toMatchObject({
      diagnostic: "unexpected_content_type",
      ok: false,
      status: 200,
    });
    await batch.close();
  });

  it("requires an exact snapshot event with matching room data", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.end(
        "event: message\ndata: {\"roomId\":\"room\",\"revision\":1,"
        + "\"note\":\"event: room.snapshot\"}\n\n",
      );
    });
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("Expected test port.");

    const batch = await openDraftStreamBatch({
      baseUrl: new URL(`http://127.0.0.1:${String(address.port)}`),
      clients: [{ roomId: "room", sessionToken: "session" }],
    });

    expect(batch.measurements[0]).toMatchObject({ diagnostic: "invalid_initial_snapshot", ok: false });
    await batch.close();
  });

  it("measures fanout when every connected client observes the expected revision event", async () => {
    const responses: ServerResponse[] = [];
    const server = createServer((_request, response) => {
      responses.push(response);
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.write("event: room.snapshot\ndata: {\"roomId\":\"room\",\"revision\":1}\n\n");
    });
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("Expected test port.");
    const batch = await openDraftStreamBatch({
      baseUrl: new URL(`http://127.0.0.1:${String(address.port)}`),
      clients: [
        { roomId: "room", sessionToken: "session-1" },
        { roomId: "room", sessionToken: "session-2" },
      ],
    });

    const reconnects = await batch.reconnectFirstClientPerRoom(["room"]);
    expect(reconnects).toEqual([expect.objectContaining({ diagnostic: "ok", ok: true })]);
    expect(responses).toHaveLength(3);

    const observed = batch.waitForRoomEvent({
      event: "room.sale",
      revision: 2,
      roomId: "room",
      timeoutMs: 100,
    });
    for (const response of responses) {
      response.write("event: room.sale\ndata: {\"roomId\":\"room\",\"revision\":2}\n\n");
    }

    expect(await observed).toEqual([
      expect.objectContaining({ diagnostic: "ok", ok: true }),
      expect.objectContaining({ diagnostic: "ok", ok: true }),
    ]);
    await batch.close();
  });
});
