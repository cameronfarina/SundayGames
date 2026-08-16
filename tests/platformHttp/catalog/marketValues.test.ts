import { InMemoryPlatformStore, SeasonSimulationError, buildCurrentMockdLeagueSeason, canonicalPlayerIdentityKey, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, defaultScoringSettings, describe, expect, expectBodyRecord, expectNumber, expectNumberRecord, expectRecordArray, it, leagueConfig, mockRunner, ownerOrder, playerCatalog } from "../support/index.js";
import type { LeagueSeason, LiveDraftRoomPlayerCatalogEntry, SeasonSimulationTargetConstraint } from "../support/index.js";

describe("platform HTTP contract", () => {
it("uses one pricing snapshot across the player catalog, mock drafts, and simulations", async () => {
    const currentCatalog: readonly LiveDraftRoomPlayerCatalogEntry[] = [
      { name: "Puka Nacua", position: "WR", expectedPrice: 50, seasonProjection: 240 },
      {
        name: "Jahmyr Gibbs",
        position: "RB",
        expectedPrice: 30,
        seasonProjection: 210,
        seasonProjectionAdjustmentFactor: 2 / 3,
        seasonProjectionScoring: defaultScoringSettings,
      },
      {
        name: "De'Von Achane",
        position: "RB",
        expectedPrice: 20,
        seasonProjection: 230,
        seasonProjectionAdjustmentFactor: 1.5,
        seasonProjectionScoring: defaultScoringSettings,
      },
      { name: "George Kittle", position: "TE", expectedPrice: 10 },
      { name: "Jake Elliott", position: "K", expectedPrice: 5 },
      { name: "Reserve Receiver One", position: "WR", expectedPrice: 3 },
      { name: "Reserve Receiver Two", position: "WR", expectedPrice: 2 },
      { name: "Reserve Receiver Three", position: "WR", expectedPrice: 1 },
    ];
    let simulationExpectedPrices: Readonly<Record<string, number>> | undefined;
    let simulationHumanValues: Readonly<Record<string, number>> | undefined;
    let simulationTargetConstraints: readonly SeasonSimulationTargetConstraint[] | undefined;
    let simulationAccountId: string | undefined;
    let rejectForAccountCapacity = false;
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      currentPlayerCatalogProvider: async () => currentCatalog,
      liveDraftRoomSetupProvider: async () => ({ playerCatalog: currentCatalog, initialRosters: [] }),
      seasonSimulationRunner: async (input, options) => {
        simulationExpectedPrices = input.playerExpectedPrices;
        simulationHumanValues = input.playerHumanValues;
        simulationTargetConstraints = input.targetConstraints;
        simulationAccountId = options?.accountId;
        if (rejectForAccountCapacity) {
          throw new SeasonSimulationError(
            "simulation_account_queue_full",
            "Too many simulations are already running for this account. Try again shortly.",
          );
        }
        return {
          draftFormat: "auction",
          runCount: input.runCount,
          completedCount: input.runCount,
          seedPrefix: input.seedPrefix ?? "market-source-test",
          strategy: {
            rawInput: input.strategyInput ?? "",
            preferredPositions: [],
            summary: "Balanced",
            warnings: [],
          },
          playerExposure: [],
          positionCounts: {},
          runs: [],
        };
      },
    });
    const owner11 = await createLoggedInAccount(handle, "market-source@example.com");
    const baseSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "draft" });
    const teams = baseSeason.teams.slice(0, 4).map((team, index) => ({
      ...team,
      id: `market-team-${index + 1}`,
      leagueSeasonId: "market-season-2026",
      ownerId: `market-owner-${index + 1}`,
    }));
    const season: LeagueSeason = {
      ...baseSeason,
      id: "market-season-2026",
      leagueId: "market-league",
      league: { ...baseSeason.league, id: "market-league", name: "Market League" },
      teams,
      settings: {
        ...baseSeason.settings,
        expectedTeamCount: 4,
        auction: { budgetDollars: 100, minimumBidDollars: 1 },
        roster: {
          rosterSize: 1,
          lineup: { WR: 1 },
          lineupSlotCount: 1,
          rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 2, K: 1, DST: 1 },
        },
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
          ownerId: teams[0]?.ownerId,
          teamId: teams[0]?.id,
        }],
      },
    });
    const rebuilt = await handle({
      method: "POST",
      path: `/seasons/${season.id}/pricing/rebuild`,
      sessionToken: owner11.sessionToken,
      body: {
        modelVersion: "market-source-test",
        scenarioIds: ["expected"],
        baselinePrices: currentCatalog.map(player => ({
          name: player.name,
          normalizedName: canonicalPlayerIdentityKey(player.name),
          position: player.position,
          price: player.expectedPrice,
        })),
      },
    });
    const snapshots = expectRecordArray(expectBodyRecord(rebuilt.body).snapshots);
    const firstSnapshot = snapshots[0];
    if (firstSnapshot === undefined) throw new Error("Expected a pricing snapshot.");
    const snapshotRows = expectRecordArray(firstSnapshot.rows);
    const snapshotValueFor = (playerName: string) => {
      const row = snapshotRows.find(candidate => candidate.playerName === playerName);
      if (row === undefined) throw new Error(`Expected ${playerName} pricing.`);
      return {
        marketPrice: expectNumber(row.marketPrice),
        scenarioPrice: expectNumber(row.scenarioPrice),
        personalValue: expectNumber(row.personalValue),
      };
    };
    const pukaPricing = snapshotValueFor("Puka Nacua");
    const gibbsPricing = snapshotValueFor("Jahmyr Gibbs");
    const achanePricing = snapshotValueFor("De'Von Achane");
    expect(pukaPricing.scenarioPrice).toBeGreaterThan(pukaPricing.marketPrice);
    await expect(handle({
      method: "GET",
      path: "/player-catalog",
      query: { seasonId: season.id, strategy: "balanced" },
      sessionToken: owner11.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        players: expect.arrayContaining([
          expect.objectContaining({
            name: "Puka Nacua",
            marketPrice: 55,
            leagueValue: pukaPricing.scenarioPrice,
            myValue: pukaPricing.personalValue,
          }),
          expect.objectContaining({
            name: "Jahmyr Gibbs",
            marketPrice: 57,
            leagueValue: gibbsPricing.scenarioPrice,
            myValue: gibbsPricing.personalValue,
          }),
          expect.objectContaining({
            name: "De'Von Achane",
            marketPrice: 50,
            leagueValue: achanePricing.scenarioPrice,
            myValue: achanePricing.personalValue,
          }),
        ]),
      },
    });

    const mockResponse = await handle({
      method: "POST",
      path: "/season-mock-drafts",
      sessionToken: owner11.sessionToken,
      body: { seasonId: season.id, strategy: "balanced" },
    });
    expect(mockResponse).toMatchObject({ status: 201 });
    const mockSession = expectBodyRecord(expectBodyRecord(mockResponse.body).mockSession);
    const mockSnapshot = expectBodyRecord(mockSession.configurationSnapshot);
    const mockPayload = expectBodyRecord(mockSnapshot.payload);
    const mockExpectedPrices = expectNumberRecord(mockPayload.playerExpectedPrices);
    const mockHumanValues = expectNumberRecord(mockPayload.playerHumanValues);
    expect(mockExpectedPrices[canonicalPlayerIdentityKey("Puka Nacua")]).toBe(pukaPricing.scenarioPrice);
    expect(mockExpectedPrices[canonicalPlayerIdentityKey("Jahmyr Gibbs")]).toBe(gibbsPricing.scenarioPrice);
    expect(mockExpectedPrices[canonicalPlayerIdentityKey("De'Von Achane")]).toBe(achanePricing.scenarioPrice);
    expect(mockHumanValues[canonicalPlayerIdentityKey("Jahmyr Gibbs")]).toBe(gibbsPricing.personalValue);
    expect(mockHumanValues[canonicalPlayerIdentityKey("De'Von Achane")]).toBe(achanePricing.personalValue);

    await expect(handle({
      method: "PUT",
      path: "/practice-shortlist",
      sessionToken: owner11.sessionToken,
      body: { seasonId: season.id, playerName: "Puka Nacua", maxBid: 57 },
    })).resolves.toMatchObject({
      status: 200,
      body: { item: { playerName: "Puka Nacua", maxBid: 57 } },
    });

    await expect(handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: owner11.sessionToken,
      body: { seasonId: season.id, count: 1 },
    })).resolves.toMatchObject({ status: 200 });
    expect(simulationAccountId).toBe(owner11.account.id);
    expect(simulationExpectedPrices?.[canonicalPlayerIdentityKey("Puka Nacua")])
      .toBe(pukaPricing.scenarioPrice);
    expect(simulationHumanValues?.[canonicalPlayerIdentityKey("Jahmyr Gibbs")])
      .toBe(gibbsPricing.personalValue);
    expect(simulationHumanValues?.[canonicalPlayerIdentityKey("De'Von Achane")])
      .toBe(achanePricing.personalValue);
    expect(simulationTargetConstraints).toEqual([{
      playerName: "Puka Nacua",
      maxAuctionPrice: 57,
    }]);
    rejectForAccountCapacity = true;
    await expect(handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: owner11.sessionToken,
      body: { seasonId: season.id, count: 1 },
    })).resolves.toEqual({
      status: 429,
      headers: { "Retry-After": "5" },
      body: {
        error: {
          code: "simulation_account_queue_full",
          message: "Too many simulations are already running for this account. Try again shortly.",
        },
      },
    });
    rejectForAccountCapacity = false;

  });
});
