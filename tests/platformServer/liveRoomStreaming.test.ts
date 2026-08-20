import { buildCurrentMockdLeagueSeason, expect, it, jsonFetch, leagueConfig, openEventStream, ownerOrder, propertyValue, sessionTokenFrom, stringProperty } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer }) => {
  it("keeps two live-room clients connected through ordered updates and releases capacity on abort", async () => {
    const { platformServer, baseUrl } = await createListeningServer({
      liveDraftRoomEventStreamMaxConnectionsPerAccount: 1,
      liveDraftRoomEventStreamMaxConnections: 2,
      liveDraftRoomEventStreamRetryAfterSeconds: 3,
    });
    let eventStreamRequestCount = 0;
    platformServer.server.on("request", request => {
      if (request.url?.includes("/event-stream") === true) eventStreamRequestCount += 1;
    });
    const camCreated = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "owner11@example.com", password: "secure password1!" }),
    });
    const sethCreated = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "owner04@example.com", password: "secure password1!" }),
    });
    const camLogin = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "owner11@example.com", password: "secure password1!" }),
    });
    const sethLogin = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "owner04@example.com", password: "secure password1!" }),
    });
    const camAccountId = stringProperty(propertyValue(camCreated.body, "account"), "id");
    const sethAccountId = stringProperty(propertyValue(sethCreated.body, "account"), "id");
    const camSessionToken = sessionTokenFrom(camLogin);
    const sethSessionToken = sessionTokenFrom(sethLogin);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Owner04");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    await jsonFetch(baseUrl, `/seasons/${season.id}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-session-token": camSessionToken,
        "x-mockd-provisioning-token": "test-provisioning-token",
      },
      body: JSON.stringify({
        season,
        memberships: [
          { userId: camAccountId, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
          { userId: sethAccountId, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
        ],
      }),
    });
    await jsonFetch(baseUrl, "/live-rooms", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": camSessionToken,
        "x-mockd-provisioning-token": "test-provisioning-token",
      },
      body: JSON.stringify({
        seasonId: season.id,
        roomId: "room_stream_wait",
        viewerPasswordHashRef: "viewer-password-hash",
        playerCatalog: [
          { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
          { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72 },
        ],
      }),
    });

    const streamPath = "/live-rooms/room_stream_wait/event-stream?afterRevision=1";
    const [camStream, sethStream] = await Promise.all([
      openEventStream(baseUrl, streamPath, camSessionToken),
      openEventStream(baseUrl, streamPath, sethSessionToken),
    ]);
    expect(eventStreamRequestCount).toBe(2);
    for (const stream of [camStream, sethStream]) {
      expect(stream.response.status).toBe(200);
      expect(stream.response.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");
      expect(stream.response.headers.get("cache-control")).toBe("no-store, no-transform");
      expect(stream.response.headers.get("connection")).toBe("keep-alive");
      expect(stream.response.headers.get("content-length")).toBeNull();
      expect(stream.response.headers.get("content-encoding")).toBeNull();
      expect(stream.response.headers.get("x-content-type-options")).toBe("nosniff");
    }

    const initialSnapshots = await Promise.all([camStream.nextEvent(), sethStream.nextEvent()]);
    expect(initialSnapshots).toEqual([
      { event: "room.snapshot", data: expect.objectContaining({ revision: 1, status: "setup" }) },
      { event: "room.snapshot", data: expect.objectContaining({ revision: 1, status: "setup" }) },
    ]);

    const assertSharedUpdate = async (
      expectedEvent: string,
      expectedRevision: number,
      expectedRoom: Record<string, unknown>,
    ): Promise<void> => {
      const updates = await Promise.all([camStream.nextEvent(), sethStream.nextEvent()]);
      expect(updates).toEqual([
        {
          event: expectedEvent,
          data: expect.objectContaining({ revision: expectedRevision, ...expectedRoom }),
        },
        {
          event: expectedEvent,
          data: expect.objectContaining({ revision: expectedRevision, ...expectedRoom }),
        },
      ]);
    };

    await jsonFetch(baseUrl, "/live-rooms/room_stream_wait/start", {
      method: "POST",
      headers: { "content-type": "application/json", "x-session-token": camSessionToken },
      body: JSON.stringify({ expectedRevision: 1, idempotencyKey: "start:room_stream_wait" }),
    });
    await assertSharedUpdate("room.started", 2, { status: "live" });

    await jsonFetch(baseUrl, "/live-rooms/room_stream_wait/sales", {
      method: "POST",
      headers: { "content-type": "application/json", "x-session-token": camSessionToken },
      body: JSON.stringify({
        expectedRevision: 2,
        idempotencyKey: "sale:puka:62",
        command: "owner11 puka 62",
      }),
    });
    await assertSharedUpdate("room.sale", 3, {
      salesLog: [expect.objectContaining({ playerName: "Puka Nacua", price: 62 })],
    });

    await jsonFetch(baseUrl, "/live-rooms/room_stream_wait/undo", {
      method: "POST",
      headers: { "content-type": "application/json", "x-session-token": camSessionToken },
      body: JSON.stringify({ expectedRevision: 3, idempotencyKey: "undo:puka:62" }),
    });
    await assertSharedUpdate("room.snapshot", 4, { salesLog: [] });

    await jsonFetch(baseUrl, "/live-rooms/room_stream_wait/pause", {
      method: "POST",
      headers: { "content-type": "application/json", "x-session-token": camSessionToken },
      body: JSON.stringify({ expectedRevision: 4, idempotencyKey: "pause:room_stream_wait" }),
    });
    await assertSharedUpdate("room.paused", 5, { status: "paused" });
    expect(eventStreamRequestCount).toBe(2);

    const limitedStream = await fetch(`${baseUrl}${streamPath}`, {
      headers: { "x-session-token": sethSessionToken },
      signal: AbortSignal.timeout(1_000),
    });
    expect(limitedStream.status).toBe(429);
    expect(limitedStream.headers.get("retry-after")).toBe("3");

    await sethStream.close();
    await new Promise(resolve => setTimeout(resolve, 20));
    const replacementStream = await openEventStream(baseUrl, streamPath, sethSessionToken);
    expect(await replacementStream.nextEvent()).toEqual({
      event: "room.snapshot",
      data: expect.objectContaining({ revision: 5, status: "paused" }),
    });

    await Promise.all([camStream.close(), replacementStream.close()]);
  });
});
