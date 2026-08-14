import { InMemoryLiveDraftRoomSetupRepository, InMemoryPlatformStore, createClientAddressRateLimiter, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, expectAsyncTextStream, expectBodyRecord, expectString, it, mockRunner, now, playerCatalog, snakePlayerCatalog, snakeSeason } from "../support/index.js";

describe("platform HTTP contract", () => {
it("runs private league-aware simulations for a claimed team", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const liveDraftRoomSetupRepository = new InMemoryLiveDraftRoomSetupRepository();
    const handle = createPlatformHttpHandler(app, {
      liveDraftRoomSetupProvider: async () => ({ playerCatalog: snakePlayerCatalog, initialRosters: [] }),
      liveDraftRoomSetupRepository,
      currentPlayerCatalogProvider: async () => snakePlayerCatalog.map((player, index) => ({
        ...player,
        week1Projection: index + 1,
      })),
      simulationRateLimiter: createClientAddressRateLimiter({
        maxAttempts: 3,
        windowMs: 60_000,
        maxTrackedEmails: 10,
      }),
    });
    const owner11 = await createLoggedInAccount(handle, "snake-simulations@example.com");
    const outsider = await createLoggedInAccount(handle, "simulation-outsider@example.com");
    const season = snakeSeason();
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: owner11.sessionToken,
      body: {
        season,
        memberships: [{
          userId: owner11.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: season.teams[0]?.ownerId,
          teamId: season.teams[0]?.id,
        }],
      },
    });
    await liveDraftRoomSetupRepository.save({
      seasonId: season.id,
      sourceVersion: "legacy-catalog-without-projections",
      playerCatalog: snakePlayerCatalog,
      initialRosters: [],
      updatedAt: now,
    });

    await expect(handle({
      method: "POST",
      path: "/season-simulations",
      body: { seasonId: season.id, count: 2, strategy: "Draft Player 1 by round 1" },
    })).resolves.toMatchObject({ status: 401, body: { error: { code: "auth_required" } } });
    await expect(handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: outsider.sessionToken,
      body: { seasonId: season.id, count: 2, strategy: "Draft Player 1 by round 1" },
    })).resolves.toMatchObject({ status: 403, body: { error: { code: "membership_required" } } });
    await expect(handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: owner11.sessionToken,
      body: { seasonId: season.id, count: 101, strategy: "Draft Player 1 by round 1" },
    })).resolves.toMatchObject({ status: 400, body: { error: { code: "invalid_run_count" } } });

    const simulationResponse = await handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: owner11.sessionToken,
      now,
      body: {
        seasonId: season.id,
        count: 2,
        strategy: "Draft Player 1 by round 1",
        note: "Compare a first-round target.",
      },
    });
    expect(simulationResponse).toMatchObject({
      status: 200,
      body: {
        summary: {
          draftFormat: "snake",
          runCount: 2,
          completedCount: 2,
          strategy: {
            target: { playerName: "Player 1", maxSnakeRound: 1 },
            warnings: [],
          },
          targetOutcome: { playerName: "Player 1", hitCount: 2, hitRate: 1 },
        },
      },
    });
    const summary = expectBodyRecord(expectBodyRecord(simulationResponse.body).summary);
    const historyId = expectString(expectBodyRecord(simulationResponse.body).historyId);
    expect(summary).not.toHaveProperty("runs");
    const newerSimulationResponse = await handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: owner11.sessionToken,
      now: new Date(now.getTime() + 1_000),
      body: { seasonId: season.id, count: 1, strategy: "Draft Player 2 by round 2" },
    });
    const newerHistoryId = expectString(expectBodyRecord(newerSimulationResponse.body).historyId);
    await expect(handle({
      method: "GET",
      path: "/season-simulations",
      query: { seasonId: season.id },
      sessionToken: owner11.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        history: [
          { id: newerHistoryId, simulation: { runCount: 1, draftFormat: "snake" } },
          {
            id: historyId,
            note: "Compare a first-round target.",
            simulation: { runCount: 2, draftFormat: "snake" },
          },
        ],
      },
    });
    await expect(handle({
      method: "GET",
      path: `/season-simulations/${historyId}`,
      sessionToken: owner11.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        historyId,
        note: "Compare a first-round target.",
        summary: { runCount: 2 },
      },
    });
    const detailResponse = await handle({
      method: "GET",
      path: `/season-simulations/${historyId}/runs/1`,
      sessionToken: owner11.sessionToken,
    });
    expect(detailResponse).toMatchObject({
      status: 200,
      body: {
        historyId,
        run: {
          label: "Run 1",
          runNumber: 1,
          teams: expect.arrayContaining([
            expect.objectContaining({ roster: expect.any(Array), week1Points: expect.any(Number) }),
          ]),
        },
      },
    });
    await expect(handle({
      method: "GET",
      path: `/season-simulations/${historyId}`,
      sessionToken: outsider.sessionToken,
    })).resolves.toMatchObject({ status: 403, body: { error: { code: "private_resource" } } });
    await expect(handle({
      method: "GET",
      path: `/season-simulations/${historyId}/runs/1`,
      sessionToken: outsider.sessionToken,
    })).resolves.toMatchObject({ status: 403, body: { error: { code: "private_resource" } } });
    await expect(handle({
      method: "GET",
      path: `/season-simulations/${historyId}/runs/3`,
      sessionToken: owner11.sessionToken,
    })).resolves.toMatchObject({ status: 404 });
    await expect(handle({
      method: "GET",
      path: `/season-simulations/${historyId}/runs/not-a-run`,
      sessionToken: owner11.sessionToken,
    })).resolves.toMatchObject({ status: 404 });
    const streamedSimulationResponse = await handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: owner11.sessionToken,
      now: new Date(now.getTime() + 2_000),
      headers: { accept: "text/event-stream" },
      body: { seasonId: season.id, count: 2, strategy: "Draft Player 1 by round 1" },
    });
    expect(streamedSimulationResponse).toMatchObject({
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "private, no-store, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
    const stream = expectAsyncTextStream(streamedSimulationResponse.body);
    let streamedEvents = "";
    for await (const chunk of stream) streamedEvents += chunk;
    expect(streamedEvents).toContain('event: progress\ndata: {"completed":1,"total":2}');
    expect(streamedEvents).toContain('event: progress\ndata: {"completed":2,"total":2}');
    expect(streamedEvents).toContain('event: result\ndata: {"historyId":');
    expect(streamedEvents).toContain('"summary":{"completedCount":2,"draftFormat":"snake"');
    expect(streamedEvents).not.toContain('"runs":');
    await expect(handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: owner11.sessionToken,
      now: new Date(now.getTime() + 3_000),
      body: { seasonId: season.id, count: 2, strategy: "Draft Player 1 by round 1" },
    })).resolves.toMatchObject({
      status: 429,
      body: { error: { code: "rate_limited" } },
      headers: { "Retry-After": "57" },
    });
  });
});
