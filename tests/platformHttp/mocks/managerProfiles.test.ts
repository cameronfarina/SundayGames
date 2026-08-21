import type {
  HistoricalImportBatch,
  HistoricalSaleRecord,
} from "../../../src/platform/historicalImports.js";
import type { LeagueSeason } from "../../../src/platform/leagueSeason.js";
import {
  InMemoryPlatformStore,
  createLoggedInAccount,
  createPlatformApp,
  createPlatformHttpHandler,
  describe,
  expect,
  expectBodyRecord,
  expectString,
  it,
  mockRunner,
  snakePlayerCatalog,
  snakeSeason,
} from "../support/index.js";

const committedBatch = (leagueId: string, seasonYear: number): HistoricalImportBatch => ({
  id: `batch-${seasonYear}`,
  leagueId,
  leagueSeasonId: `history-${seasonYear}`,
  seasonYear,
  fileHash: `hash-${seasonYear}`,
  status: "committed",
  replacementRequested: false,
  createdAt: new Date(`${seasonYear}-08-01T00:00:00.000Z`),
  committedAt: new Date(`${seasonYear}-08-01T00:01:00.000Z`),
  blockers: [],
  warnings: [],
  rows: [],
});

const ownerSales = (
  ownerId: string,
  leagueId: string,
  seasonYear: number,
  priceDollars: number,
): HistoricalSaleRecord[] => Array.from({ length: 4 }, (_, index) => ({
  id: `sale-${seasonYear}-${index}`,
  batchId: `batch-${seasonYear}`,
  leagueId,
  leagueSeasonId: `history-${seasonYear}`,
  seasonYear,
  rowNumber: index + 1,
  ownerId,
  ownerDisplayName: ownerId,
  playerId: `historical-player-${seasonYear}-${index}`,
  playerName: `Historical Player ${index + 1}`,
  position: index < 3 ? "WR" : "RB",
  priceDollars,
  publicPriceDollars: Math.max(1, priceDollars - 5),
  keeper: false,
  acquisitionType: "auction",
}));

describe("practice auction manager profiles", () => {
  it("freezes imported owner history when the mock is created", async () => {
    const store = new InMemoryPlatformStore();
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      liveDraftRoomSetupProvider: async () => ({
        playerCatalog: snakePlayerCatalog,
        initialRosters: [],
      }),
    });
    const account = await createLoggedInAccount(handle, "manager-profile@example.com");
    const base = snakeSeason();
    if (base.settings.scoring === undefined) throw new Error("Expected scoring settings.");
    const season: LeagueSeason = {
      ...base,
      settings: {
        expectedTeamCount: base.settings.expectedTeamCount,
        scoring: base.settings.scoring,
        roster: base.settings.roster,
        keeperPolicy: base.settings.keeperPolicy,
        draftFormat: "auction",
        auction: { budgetDollars: 200, minimumBidDollars: 1 },
      },
    };
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: account.sessionToken,
      body: {
        season,
        memberships: [{
          userId: account.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: season.teams[0]?.ownerId,
          teamId: season.teams[0]?.id,
        }],
      },
    });
    const profiledTeam = season.teams[1];
    if (profiledTeam === undefined) throw new Error("Expected a rival team.");
    store.historicalImports.replaceBatchesAndRecords(
      [committedBatch(season.leagueId, 2024), committedBatch(season.leagueId, 2025)],
      [
        ...ownerSales(profiledTeam.ownerId, season.leagueId, 2024, 35),
        ...ownerSales(profiledTeam.ownerId, season.leagueId, 2025, 35),
      ],
    );

    const created = await handle({
      method: "POST",
      path: "/season-mock-drafts",
      sessionToken: account.sessionToken,
      body: { seasonId: season.id, strategy: "balanced" },
    });
    expect(created).toMatchObject({
      status: 201,
      body: {
        managerProfiles: expect.arrayContaining([expect.objectContaining({
          teamId: profiledTeam.id,
          status: "ready",
        })]),
        mockSession: { configurationSnapshot: { payload: {
          managerProfiles: expect.arrayContaining([expect.objectContaining({
            teamId: profiledTeam.id,
            aiTendency: expect.objectContaining({ premiumBidMultiplier: expect.any(Number) }),
          })]),
        } } },
      },
    });
    const createdBody = expectBodyRecord(created.body);
    const sessionId = expectString(expectBodyRecord(createdBody.mockSession).id);
    store.historicalImports.replaceBatchesAndRecords(
      [committedBatch(season.leagueId, 2024), committedBatch(season.leagueId, 2025)],
      [
        ...ownerSales(profiledTeam.ownerId, season.leagueId, 2024, 1),
        ...ownerSales(profiledTeam.ownerId, season.leagueId, 2025, 1),
      ],
    );

    const loaded = await handle({
      method: "GET",
      path: `/season-mock-drafts/${sessionId}?seasonId=${season.id}`,
      sessionToken: account.sessionToken,
    });
    expect(expectBodyRecord(loaded.body).managerProfiles).toEqual(createdBody.managerProfiles);
  });
});
