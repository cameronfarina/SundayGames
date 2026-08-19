import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import {
  InMemoryHistoricalImportRepository,
  type HistoricalImportPlayerCatalogEntry,
} from "../src/platform/historicalImports.js";
import {
  isSlotPriceSaleRecord,
  slotPriceOwnerDisplayName,
} from "../src/platform/historicalImports/slotPriceProvenance.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import {
  commitHistoricalImportWorkflow,
  previewHistoricalImportSourceWorkflow,
} from "../src/platform/platformHistoricalImportWorkflow.js";
import { leagueInflationFor } from "../src/platform/pricingRebuild/leagueInflation.js";
import type { PricingSourcePrice } from "../src/platform/pricingSnapshots.js";

const now = new Date("2026-08-09T12:00:00.000Z");
const leagueSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
  seasonYear: 2025,
  setupStatus: "locked",
});
const playerCatalog = [
  { playerId: "player-jamarr-chase", name: "Ja'Marr Chase", position: "WR" },
] as const satisfies readonly HistoricalImportPlayerCatalogEntry[];

const baselinePrices = [
  { name: "Alpha Runner", normalizedName: "alpha runner", position: "RB", price: 60 },
] satisfies readonly PricingSourcePrice[];

const previewSlotPrices = async (sourceText: string, seasonYear = 2025) => {
  const repository = new InMemoryHistoricalImportRepository([leagueSeason]);
  const preview = await previewHistoricalImportSourceWorkflow({
    repository,
    leagueId: leagueSeason.leagueId,
    seasonYear,
    ...(seasonYear === leagueSeason.seasonYear
      ? {}
      : { seasonContext: { currentLeagueSeason: leagueSeason } }),
    sourceText,
    playerCatalog,
    now,
  });
  return { preview, repository };
};

const importSlotPrices = async (sourceText: string, seasonYear = 2025) => {
  const { preview, repository } = await previewSlotPrices(sourceText, seasonYear);
  const committed = await commitHistoricalImportWorkflow({
    repository,
    batchId: preview.batch.id,
    now,
  });
  return { preview, committed };
};

const inflationFor = (records: Parameters<typeof leagueInflationFor>[0]["historicalSaleRecords"]) =>
  leagueInflationFor({
    leagueId: leagueSeason.leagueId,
    seasonYear: 2026,
    modelVersion: "league-flat-inflation-v2",
    scenarioIds: ["balanced"],
    baselinePrices,
    historicalSaleRecords: records,
    currentTeamCount: 14,
    currentAuctionBudget: 200,
    currentRosterSize: 16,
    currentMinimumBidDollars: 1,
  });

// RB1 is $57 on the published board and WR1 is $56.
const twoSlots = ["Slot,Price", "RB1,80", "WR1,70"].join("\n");

describe("slot price import", () => {
  it("imports slot prices without asking anyone to map an owner", async () => {
    const { preview, committed } = await importSlotPrices(twoSlots);

    expect(preview.batch).toMatchObject({ status: "previewed", blockers: [] });
    expect(committed.committedRecords).toHaveLength(2);
  });

  it("calibrates the league multiplier from imported slot prices", async () => {
    const { committed } = await importSlotPrices(twoSlots);
    const result = inflationFor(committed.committedRecords);

    expect(result).toMatchObject({
      source: "history",
      countedSaleCount: 2,
      leagueDollars: 150,
      publicDollars: 113,
      multiplier: 1.33,
    });
  });

  it("stores a slot sale that no one can mistake for a named player's sale", async () => {
    const { committed } = await importSlotPrices(twoSlots);
    const record = committed.committedRecords[0];

    expect(record).toMatchObject({
      ownerDisplayName: slotPriceOwnerDisplayName,
      playerName: "RB1",
      playerId: "player-rb1-rb",
      position: "RB",
      priceDollars: 80,
      publicPriceDollars: 57,
      keeper: false,
      acquisitionType: "auction",
    });
    expect(committed.committedRecords.every(isSlotPriceSaleRecord)).toBe(true);
  });

  // The bottom of an auction board is priced by the minimum bid rather than by
  // how rich the league is, so those rows would drag the multiplier toward 1.
  it("stores the cheap tail of a slot sheet but keeps it out of the calibration", async () => {
    const { committed } = await importSlotPrices([
      "Slot,Price",
      "RB1,80",
      "WR1,70",
      "RB29,2",
      "RB30,1",
    ].join("\n"));
    const result = inflationFor(committed.committedRecords);

    expect(committed.committedRecords).toHaveLength(4);
    expect(result.countedSaleCount).toBe(2);
    expect(result.multiplier).toBe(1.33);
  });

  it("keeps kicker and defense slots out of the calibration", async () => {
    const { committed } = await importSlotPrices([
      "Slot,Price",
      "RB1,80",
      "WR1,70",
      "K1,5",
      "DST1,6",
    ].join("\n"));
    const result = inflationFor(committed.committedRecords);

    expect(committed.committedRecords).toHaveLength(4);
    expect(result.countedSaleCount).toBe(2);
  });

  it("calibrates an older season against the published board it has", async () => {
    const { committed } = await importSlotPrices(
      ["Slot,Price,Season", "RB1,80,2022", "WR1,70,2022"].join("\n"),
      2022,
    );
    const result = inflationFor(committed.committedRecords);

    expect(result).toMatchObject({ source: "history", multiplier: 1.33 });
  });

  it("refuses a sheet whose season disagrees with the draft year being imported", async () => {
    const { preview } = await previewSlotPrices(
      ["Slot,Price,Season", "RB1,80,2024"].join("\n"),
      2025,
    );

    expect(preview.batch.status).toBe("blocked");
    expect(preview.batch.blockers.map(blocker => blocker.code)).toContain("season_missing");
  });

  it("blocks a slot whose position is not a real one", async () => {
    const { preview } = await previewSlotPrices(["Slot,Price", "FLEX1,40"].join("\n"));

    expect(preview.batch.status).toBe("blocked");
    expect(preview.batch.blockers.map(blocker => blocker.code)).toContain("position_invalid");
  });
});
