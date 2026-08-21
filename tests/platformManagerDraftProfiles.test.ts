import { describe, expect, it } from "vitest";
import type { HistoricalSaleRecord } from "../src/platform/historicalImports.js";
import { managerDraftProfilesFor } from "../src/platform/managerDraftProfiles.js";
import type { GenericAuctionMockPlayer } from "../src/platform/genericAuctionMockEngine.js";

const teams = [
  { id: "team-1", ownerId: "owner-1" },
  { id: "team-2", ownerId: "owner-2" },
];

const players: GenericAuctionMockPlayer[] = [
  { id: "p1", name: "One", position: "WR", expectedPrice: 30 },
  { id: "p2", name: "Two", position: "RB", expectedPrice: 30 },
  { id: "p3", name: "Three", position: "TE", expectedPrice: 20 },
  { id: "p4", name: "Four", position: "QB", expectedPrice: 10 },
];

const sale = (
  ownerId: string,
  seasonYear: number,
  rowNumber: number,
  overrides: Partial<HistoricalSaleRecord> = {},
): HistoricalSaleRecord => ({
  id: `${ownerId}-${seasonYear}-${rowNumber}`,
  batchId: "batch",
  leagueId: "league-1",
  leagueSeasonId: `season-${seasonYear}`,
  seasonYear,
  rowNumber,
  ownerId,
  ownerDisplayName: ownerId,
  playerId: `player-${rowNumber}`,
  playerName: `Player ${rowNumber}`,
  position: rowNumber % 4 === 0 ? "RB" : "WR",
  priceDollars: rowNumber % 4 === 0 ? 10 : 30,
  publicPriceDollars: rowNumber % 4 === 0 ? 10 : 20,
  keeper: false,
  acquisitionType: "auction",
  ...overrides,
});

describe("league manager draft profiles", () => {
  it("derives a ready profile and the exact AI tendency from enough prior auction history", () => {
    const records = [2024, 2025].flatMap(year => [
      sale("owner-1", year, 1),
      sale("owner-1", year, 2),
      sale("owner-1", year, 3),
      sale("owner-1", year, 4),
      sale("owner-2", year, 5, { position: "RB", priceDollars: 20, publicPriceDollars: 20 }),
      sale("owner-2", year, 6, { position: "RB", priceDollars: 20, publicPriceDollars: 20 }),
      sale("owner-2", year, 7, { position: "WR", priceDollars: 20, publicPriceDollars: 20 }),
      sale("owner-2", year, 8, { position: "TE", priceDollars: 20, publicPriceDollars: 20 }),
    ]);

    const profiles = managerDraftProfilesFor({
      leagueId: "league-1",
      teams,
      players,
      keptPlayerIds: new Set<string>(),
      historicalSaleRecords: records,
    });

    expect(profiles).toHaveLength(2);
    expect(profiles[0]).toMatchObject({
      teamId: "team-1",
      status: "ready",
      sample: { seasonCount: 2, auctionPurchaseCount: 8, comparablePurchaseCount: 8 },
      confidence: "limited",
      targetPosition: "WR",
      targetLabel: "WR focus",
      premiumVsLeagueBaselinePercent: 50,
      starBidding: "typical",
      aiTendency: {
        premiumBidMultiplier: 1,
        positionBidMultipliers: { WR: expect.any(Number) },
        nominationPositionWeights: { WR: expect.any(Number) },
      },
    });
  });

  it("uses neutral behavior and no invented metrics when evidence is sparse", () => {
    const profiles = managerDraftProfilesFor({
      leagueId: "league-1",
      teams,
      players,
      keptPlayerIds: new Set<string>(),
      historicalSaleRecords: [sale("owner-1", 2025, 1)],
    });

    expect(profiles[0]).toEqual({
      teamId: "team-1",
      status: "insufficient-history",
      sample: { seasonCount: 1, auctionPurchaseCount: 1, comparablePurchaseCount: 1 },
      confidence: null,
      targetPosition: null,
      targetLabel: null,
      premiumVsLeagueBaselinePercent: null,
      starBidding: null,
    });
    expect(profiles[1]?.status).toBe("insufficient-history");
  });

  it("excludes keepers, slot prices, other leagues, and unmapped owners", () => {
    const ignored = [
      sale("owner-1", 2024, 1, { keeper: true, acquisitionType: "keeper" }),
      sale("owner-1", 2024, 2, {
        ownerDisplayName: "Slot prices (no owner)", playerName: "WR1",
      }),
      sale("owner-1", 2024, 3, { leagueId: "other-league" }),
      sale("former-owner", 2024, 4),
    ];

    const profiles = managerDraftProfilesFor({
      leagueId: "league-1",
      teams,
      players,
      keptPlayerIds: new Set<string>(),
      historicalSaleRecords: ignored,
    });

    expect(profiles.every(profile => profile.sample.auctionPurchaseCount === 0)).toBe(true);
  });

  it("keeps star bidding neutral when the available board has no positive prices", () => {
    const records = [2024, 2025].flatMap(year => Array.from(
      { length: 4 },
      (_, index) => sale("owner-1", year, index + 1),
    ));

    const [profile] = managerDraftProfilesFor({
      leagueId: "league-1",
      teams,
      players: players.map(player => ({ ...player, expectedPrice: 0 })),
      keptPlayerIds: new Set<string>(),
      historicalSaleRecords: records,
    });

    expect(profile).toMatchObject({
      status: "ready",
      starBidding: "typical",
      aiTendency: { premiumBidMultiplier: 1 },
    });
  });

  it("does not invent league-relative metrics when only one manager has history", () => {
    const records = [2024, 2025].flatMap(year => Array.from(
      { length: 4 },
      (_, index) => sale("owner-1", year, index + 1),
    ));

    const [profile] = managerDraftProfilesFor({
      leagueId: "league-1",
      teams,
      players,
      keptPlayerIds: new Set<string>(),
      historicalSaleRecords: records,
    });

    expect(profile).toMatchObject({
      status: "ready",
      targetPosition: null,
      targetLabel: null,
      premiumVsLeagueBaselinePercent: null,
    });
  });

  it("requires peer evidence from at least two of the manager's historical seasons", () => {
    const ownerRecords = [2024, 2025].flatMap(year => Array.from(
      { length: 4 },
      (_, index) => sale("owner-1", year, index + 1),
    ));
    const peerRecords = [2022, 2024].flatMap(year => Array.from(
      { length: 8 },
      (_, index) => sale("owner-2", year, index + 20, {
        position: "RB",
        priceDollars: 20,
        publicPriceDollars: 20,
      }),
    ));

    const [profile] = managerDraftProfilesFor({
      leagueId: "league-1",
      teams,
      players,
      keptPlayerIds: new Set<string>(),
      historicalSaleRecords: [...ownerRecords, ...peerRecords],
    });

    expect(profile).toMatchObject({
      status: "ready",
      targetPosition: null,
      targetLabel: null,
      premiumVsLeagueBaselinePercent: null,
    });
  });
});
