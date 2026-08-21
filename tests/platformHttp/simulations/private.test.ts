import { InMemoryLiveDraftRoomSetupRepository, InMemoryPlatformStore, browserSimulationResult, completeBrowserSimulation, createClientAddressRateLimiter, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, expectBodyRecord, expectBrowserSimulationCancellation, expectString, it, mockRunner, now, snakePlayerCatalog, snakeSeason } from "../support/index.js";

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
      body: { seasonId: season.id, count: 26, strategy: "Draft Player 1 by round 1" },
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
        requestId: "private-request-1",
      },
    });
    expect(simulationResponse).toMatchObject({ status: 202 });
    const launch = expectBodyRecord(simulationResponse.body);
    const historyId = expectString(expectBodyRecord(simulationResponse.body).historyId);
    await expect(handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: owner11.sessionToken,
      now,
      body: {
        seasonId: season.id,
        count: 1,
        strategy: "Changed after the interrupted response",
        note: "Changed note",
        requestId: "private-request-1",
      },
    })).resolves.toMatchObject({
      status: 202,
      body: {
        historyId,
        inputDigest: launch.inputDigest,
        note: "Compare a first-round target.",
        input: { runCount: 2 },
      },
    });
    await expect(handle({
      method: "POST",
      path: `/season-simulations/${historyId}/complete`,
      sessionToken: owner11.sessionToken,
      now,
      body: {
        simulation: browserSimulationResult(simulationResponse),
        inputDigest: "wrong-digest",
      },
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "invalid_configuration" } },
    });
    const completedResponse = await completeBrowserSimulation({
      handle, launchResponse: simulationResponse, sessionToken: owner11.sessionToken, now,
    });
    expect(completedResponse).toMatchObject({
      status: 200,
      body: { summary: { draftFormat: "snake", runCount: 2, completedCount: 2 } },
    });
    const summary = expectBodyRecord(expectBodyRecord(completedResponse.body).summary);
    expect(summary).not.toHaveProperty("runs");
    expect(summary.outcomes).toEqual([
      expect.objectContaining({ favorite: false, rank: 1, runNumber: 1 }),
      expect.objectContaining({ favorite: false, rank: 2, runNumber: 2 }),
    ]);
    const newerSimulationResponse = await handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: owner11.sessionToken,
      now: new Date(now.getTime() + 1_000),
      body: { seasonId: season.id, count: 1, strategy: "Draft Player 2 by round 2" },
    });
    const newerHistoryId = expectString(expectBodyRecord(newerSimulationResponse.body).historyId);
    await completeBrowserSimulation({
      handle, launchResponse: newerSimulationResponse, sessionToken: owner11.sessionToken,
      now: new Date(now.getTime() + 1_000),
    });
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
      method: "PATCH",
      path: `/season-simulations/${historyId}/runs/1`,
      sessionToken: owner11.sessionToken,
      body: { favorite: true },
    })).resolves.toMatchObject({
      status: 200,
      body: {
        historyId,
        outcome: expect.objectContaining({ favorite: true, runNumber: 1 }),
      },
    });
    await expect(handle({
      method: "GET",
      path: "/season-simulations",
      query: { seasonId: season.id },
      sessionToken: owner11.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        history: expect.arrayContaining([expect.objectContaining({
          id: historyId,
          simulation: expect.objectContaining({
            outcomes: expect.arrayContaining([
              expect.objectContaining({ favorite: true, runNumber: 1 }),
            ]),
          }),
        })]),
      },
    });
    await expect(handle({
      method: "PATCH",
      path: `/season-simulations/${historyId}/runs/1`,
      sessionToken: outsider.sessionToken,
      body: { favorite: true },
    })).resolves.toMatchObject({ status: 403, body: { error: { code: "private_resource" } } });
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
    await expectBrowserSimulationCancellation({
      handle, sessionToken: owner11.sessionToken, seasonId: season.id, now,
    });
  });
});
