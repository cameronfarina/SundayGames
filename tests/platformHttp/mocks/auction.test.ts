import { InMemoryPlatformStore, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, expectBodyRecord, expectString, it, mockRunner, playerCatalog, snakePlayerCatalog, snakeSeason } from "../support/index.js";
import type { LeagueSeason } from "../support/index.js";

describe("platform HTTP contract", () => {
it("uses the same durable mock contract for auction leagues", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      liveDraftRoomSetupProvider: async () => ({
        playerCatalog: snakePlayerCatalog,
        initialRosters: [{
          teamId: "snake-team-1",
          playerId: "player 1",
          playerName: "Player 1",
          position: "RB",
          price: 42,
          source: "keeper",
        }],
      }),
    });
    const owner11 = await createLoggedInAccount(handle, "auction-mock@example.com");
    const snake = snakeSeason();
    if (snake.settings.draftFormat !== "snake") throw new Error("Expected snake settings.");
    const { expectedTeamCount, scoring, roster, keeperPolicy } = snake.settings;
    const season: LeagueSeason = {
      ...snake,
      id: "auction-season-2026",
      teams: snake.teams.map(team => ({ ...team, leagueSeasonId: "auction-season-2026" })),
      settings: {
        expectedTeamCount,
        scoring,
        roster,
        keeperPolicy,
        draftFormat: "auction",
        auction: { budgetDollars: 200, minimumBidDollars: 1 },
      },
    };
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
    const created = await handle({
      method: "POST",
      path: "/season-mock-drafts",
      sessionToken: owner11.sessionToken,
      body: { seasonId: season.id, strategy: "wr-heavy" },
    });
    expect(created).toMatchObject({
      status: 201,
      body: {
        mockSession: {
          draftMode: { format: "auction", label: expect.stringContaining("WR Heavy") },
          configurationSnapshot: {
            payload: {
              playerExpectedPrices: expect.any(Object),
              playerHumanValues: expect.any(Object),
            },
          },
        },
        state: {
          session: { status: "setup", phase: "not_started" },
          board: {
            players: expect.arrayContaining([
              expect.objectContaining({
                id: "player 1",
                expectedPrice: expect.any(Number),
                humanValue: expect.any(Number),
                available: false,
              }),
            ]),
          },
          teams: expect.arrayContaining([
            expect.objectContaining({
              id: "snake-team-1",
              spent: 42,
              budgetRemaining: 158,
              rosterSlotsRemaining: 1,
              maxBid: 158,
              roster: [expect.objectContaining({
                playerId: "player 1",
                price: 42,
                source: "keeper",
              })],
            }),
          ]),
        },
      },
    });
    const createdBody = expectBodyRecord(created.body);
    const mockSession = expectBodyRecord(createdBody.mockSession);
    const mockSessionId = expectString(mockSession.id);
    const setupState = expectBodyRecord(createdBody.state);
    const started = await handle({
      method: "POST",
      path: `/season-mock-drafts/${mockSessionId}/commands`,
      sessionToken: owner11.sessionToken,
      body: {
        seasonId: season.id,
        commandId: "start-auction",
        command: { type: "start", expectedRevision: 0 },
      },
    });
    expect(started).toMatchObject({
      status: 200,
      body: { state: { session: { status: "active", phase: "awaiting_human_nomination" } } },
    });
    expect(expectBodyRecord(expectBodyRecord(started.body).state).teams).toEqual(setupState.teams);
  });
});
