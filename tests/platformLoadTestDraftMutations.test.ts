import { createServer, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { runDraftMutationLoad } from "../scripts/platformLoadTest/draftMutations.js";
import { openDraftStreamBatch } from "../scripts/platformLoadTest/draftStreams.js";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async server =>
    await new Promise<void>(resolve => server.close(() => resolve()))));
});

describe("platform live-draft mutation load", () => {
  it("paces room mutations, verifies fanout, and reconnects at the committed revision", async () => {
    const streamResponses = new Map<string, ServerResponse>();
    const mutationPaths: string[] = [];
    const roomRevisions = new Map<string, number>();
    const server = createServer((request, response) => {
      const segments = request.url?.split("/") ?? [];
      const roomId = segments[2] ?? "";
      if (request.method === "GET" && request.url?.endsWith("/event-stream") === true) {
        const token = String(request.headers["x-session-token"]);
        streamResponses.set(`${roomId}:${token}`, response);
        response.writeHead(200, { "Content-Type": "text/event-stream" });
        const revision = roomRevisions.get(roomId) ?? 1;
        response.write(`event: room.snapshot\ndata: {"roomId":"${roomId}","revision":${String(revision)}}\n\n`);
        return;
      }
      request.resume();
      mutationPaths.push(request.url ?? "");
      roomRevisions.set(roomId, 2);
      for (const [key, streamResponse] of streamResponses) {
        if (key.startsWith(`${roomId}:`)) {
          streamResponse.write(`event: room.sale\ndata: {"roomId":"${roomId}","revision":2}\n\n`);
        }
      }
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
        room: { roomId, revision: 2 },
      }));
    });
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("Expected test port.");
    const baseUrl = new URL(`http://127.0.0.1:${String(address.port)}`);
    const clients = ["room-1", "room-2"].flatMap(roomId => ["a", "b"].map(sessionToken => ({
      roomId,
      sessionToken: `${roomId}-${sessionToken}`,
    })));
    const batch = await openDraftStreamBatch({ baseUrl, clients });

    const result = await runDraftMutationLoad({
      baseUrl,
      clientsPerRoom: 2,
      eventTimeoutMs: 100,
      mutations: ["room-1", "room-2"].map(roomId => ({
        action: "sales" as const,
        body: { expectedRevision: 1 },
        roomId,
        sessionToken: `${roomId}-a`,
      })),
      paceMs: 1,
      streams: batch,
    });

    expect(result.mutationMeasurements.every(measurement => measurement.ok)).toBe(true);
    expect(result.reconnectMeasurements).toHaveLength(2);
    expect(result.fanoutMeasurements).toHaveLength(4);
    expect(result.fanoutMeasurements.every(measurement => measurement.ok)).toBe(true);
    expect(mutationPaths.sort()).toEqual([
      "/live-rooms/room-1/sales",
      "/live-rooms/room-2/sales",
    ]);
    await batch.close();
  });

  it("rejects a reconnect whose durable snapshot is behind the committed mutation", async () => {
    const streamResponses = new Map<string, ServerResponse>();
    const server = createServer((request, response) => {
      const segments = request.url?.split("/") ?? [];
      const roomId = segments[2] ?? "";
      if (request.method === "GET" && request.url?.endsWith("/event-stream") === true) {
        const token = String(request.headers["x-session-token"]);
        streamResponses.set(token, response);
        response.writeHead(200, { "Content-Type": "text/event-stream" });
        response.write(`event: room.snapshot\ndata: {"roomId":"${roomId}","revision":1}\n\n`);
        return;
      }
      request.resume();
      for (const streamResponse of streamResponses.values()) {
        streamResponse.write(`event: room.sale\ndata: {"roomId":"${roomId}","revision":2}\n\n`);
      }
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
        room: { roomId, revision: 2 },
      }));
    });
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("Expected test port.");
    const baseUrl = new URL(`http://127.0.0.1:${String(address.port)}`);
    const batch = await openDraftStreamBatch({
      baseUrl,
      clients: [
        { roomId: "room", sessionToken: "session-a" },
        { roomId: "room", sessionToken: "session-b" },
      ],
    });

    const result = await runDraftMutationLoad({
      baseUrl,
      clientsPerRoom: 2,
      eventTimeoutMs: 100,
      mutations: [{
        action: "sales",
        body: { expectedRevision: 1 },
        roomId: "room",
        sessionToken: "session-a",
      }],
      paceMs: 0,
      streams: batch,
    });
    await batch.close();

    expect(result.mutationMeasurements[0]).toMatchObject({ diagnostic: "ok", ok: true });
    expect(result.fanoutMeasurements.every(measurement => measurement.ok)).toBe(true);
    expect(result.reconnectMeasurements).toEqual([
      expect.objectContaining({ diagnostic: "unexpected_initial_snapshot_revision", ok: false }),
    ]);
  });
});
